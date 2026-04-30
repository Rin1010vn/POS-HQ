const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const KEYFILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!SPREADSHEET_ID) {
  console.error('ERROR: SPREADSHEET_ID is not set in environment');
  process.exit(1);
}

let sheetsApi = null;
let spreadsheetMeta = null;

async function initSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILE,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  const client = await auth.getClient();
  sheetsApi = google.sheets({ version: 'v4', auth: client });
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  spreadsheetMeta = meta.data;
}

function rowsToObjects(values) {
  if (!values || values.length === 0) return [];
  const headers = values[0];
  const rows = values.slice(1);
  return rows.map(r => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = r[i] === undefined ? '' : r[i];
    });
    for (const k in o) {
      if (k === 'phone') {
        o[k] = o[k] === '' ? '' : String(o[k]);
        continue;
      }
      const n = Number(o[k]);
      if (!isNaN(n) && String(o[k]).trim() !== '') o[k] = n;
    }
    if (o.items && typeof o.items === 'string') {
      try { o.items = JSON.parse(o.items); } catch (e) { /* ignore */ }
    }
    return o;
  });
}

async function readSheet(sheetName) {
  const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:Z` });
  return rowsToObjects(res.data.values);
}

async function appendRow(sheetName, rowValues) {
  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'RAW',
    resource: { values: [rowValues] }
  });
}

async function findRowIndex(sheetName, id) {
  const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:Z` });
  const values = res.data.values || [];
  if (values.length < 2) return -1;
  const headers = values[0];
  const idIndex = headers.findIndex(h => h.toLowerCase() === 'id');
  if (idIndex === -1) return -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(id)) return i + 1;
  }
  return -1;
}

async function getSheetIdByName(name) {
  const s = spreadsheetMeta.sheets.find(sh => sh.properties.title === name);
  return s ? s.properties.sheetId : null;
}

async function updateRow(sheetName, rowNumber, rowValues) {
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowNumber}:Z${rowNumber}`,
    valueInputOption: 'RAW',
    resource: { values: [rowValues] }
  });
}

async function deleteRow(sheetName, rowNumber) {
  const sheetId = await getSheetIdByName(sheetName);
  if (!sheetId) throw new Error('Sheet not found: ' + sheetName);
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [
        { deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowNumber-1, endIndex: rowNumber } } }
      ]
    }
  });
}

async function ensureInit() {
  if (!sheetsApi) await initSheets();
}

async function getHeaders(sheetName) {
  const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A1:Z1` });
  return (res.data.values && res.data.values[0]) || [];
}

function buildRowFromObj(headers, obj) {
  return headers.map(h => {
    if (h === 'items' && obj.items) return JSON.stringify(obj.items);
    return obj[h] === undefined ? '' : String(obj[h]);
  });
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/health', (req, res) => res.json({ success: true, message: 'ok' }));

app.get('/api', async (req, res) => {
  try {
    await ensureInit();
    const products = await readSheet('products');
    const customers = await readSheet('customers');
    const orders = await readSheet('orders');
    res.json({ success: true, data: { products, customers, orders } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api', async (req, res) => {
  const { action, data } = req.body || {};
  try {
    await ensureInit();
    if (action === 'GET_ALL') {
      const products = await readSheet('products');
      const customers = await readSheet('customers');
      const orders = await readSheet('orders');
      return res.json({ success: true, data: { products, customers, orders } });
    }

    if (action === 'ADD_PRODUCT') {
      const headers = await getHeaders('products');
      const row = buildRowFromObj(headers, data);
      await appendRow('products', row);
      return res.json({ success: true });
    }

    if (action === 'UPDATE_PRODUCT') {
      const rowNum = await findRowIndex('products', data.id);
      if (rowNum === -1) return res.status(404).json({ success: false, error: 'Not found' });
      const headers = await getHeaders('products');
      const row = buildRowFromObj(headers, data);
      await updateRow('products', rowNum, row);
      return res.json({ success: true });
    }

    if (action === 'DELETE_PRODUCT') {
      const rowNum = await findRowIndex('products', data.id);
      if (rowNum === -1) return res.status(404).json({ success: false, error: 'Not found' });
      await deleteRow('products', rowNum);
      return res.json({ success: true });
    }

    if (action === 'ADD_CUSTOMER') {
      const headers = await getHeaders('customers');
      const row = buildRowFromObj(headers, data);
      await appendRow('customers', row);
      return res.json({ success: true });
    }

    if (action === 'UPDATE_CUSTOMER') {
      const rowNum = await findRowIndex('customers', data.id);
      if (rowNum === -1) return res.status(404).json({ success: false, error: 'Not found' });
      const headers = await getHeaders('customers');
      const row = buildRowFromObj(headers, data);
      await updateRow('customers', rowNum, row);
      return res.json({ success: true });
    }

    if (action === 'DELETE_CUSTOMER') {
      const rowNum = await findRowIndex('customers', data.id);
      if (rowNum === -1) return res.status(404).json({ success: false, error: 'Not found' });
      await deleteRow('customers', rowNum);
      return res.json({ success: true });
    }

    if (action === 'CREATE_ORDER') {
      const headers = await getHeaders('orders');
      const payload = { ...data };
      if (payload.items) payload.items = JSON.stringify(payload.items);
      const row = buildRowFromObj(headers, payload);
      await appendRow('orders', row);

      // ✅ Trừ tồn kho thực tế trong sheet products
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length > 0) {
        const prodHeaders = await getHeaders('products');
        const stockIdx = prodHeaders.findIndex(h => h.toLowerCase() === 'stock');
        if (stockIdx !== -1) {
          // Đọc toàn bộ sheet products 1 lần
          const prodRes = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'products!A1:Z'
          });
          const allRows = prodRes.data.values || [];
          const idIdx = prodHeaders.findIndex(h => h.toLowerCase() === 'id');

          for (const item of items) {
            // Tìm dòng sản phẩm (allRows[0] = header, dòng data từ index 1)
            const rowIdx = allRows.findIndex((r, i) => i > 0 && String(r[idIdx]) === String(item.id));
            if (rowIdx === -1) continue;
            const currentStock = Number(allRows[rowIdx][stockIdx]) || 0;
            const newStock = Math.max(0, currentStock - item.qty);
            // Cập nhật trong Google Sheets (rowIdx+1 vì sheets 1-indexed)
            await updateRow('products', rowIdx + 1, allRows[rowIdx].map((v, i) => i === stockIdx ? String(newStock) : v));
            // Cập nhật bản sao local để các item tiếp theo trong vòng lặp dùng đúng stock
            allRows[rowIdx][stockIdx] = String(newStock);
          }
        }
      }

      return res.json({ success: true });
    }

    if (action === 'DELETE_ORDER') {
      const rowNum = await findRowIndex('orders', data.id);
      if (rowNum === -1) return res.status(404).json({ success: false, error: 'Not found' });

      // ✅ Hoàn lại tồn kho khi xóa đơn hàng
      const orderRes = await sheetsApi.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `orders!A${rowNum}:Z${rowNum}`
      });
      const orderRowVals = (orderRes.data.values && orderRes.data.values[0]) || [];
      const orderHeaders = await getHeaders('orders');
      const itemsIdx = orderHeaders.findIndex(h => h.toLowerCase() === 'items');
      let restoredItems = [];
      if (itemsIdx !== -1 && orderRowVals[itemsIdx]) {
        try { restoredItems = JSON.parse(orderRowVals[itemsIdx]); } catch(e) {}
      }

      await deleteRow('orders', rowNum);

      if (restoredItems.length > 0) {
        const prodHeaders = await getHeaders('products');
        const stockIdx = prodHeaders.findIndex(h => h.toLowerCase() === 'stock');
        if (stockIdx !== -1) {
          const prodRes = await sheetsApi.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'products!A1:Z'
          });
          const allRows = prodRes.data.values || [];
          const idIdx = prodHeaders.findIndex(h => h.toLowerCase() === 'id');
          for (const item of restoredItems) {
            const rowIdx = allRows.findIndex((r, i) => i > 0 && String(r[idIdx]) === String(item.id));
            if (rowIdx === -1) continue;
            const currentStock = Number(allRows[rowIdx][stockIdx]) || 0;
            const newStock = currentStock + (item.qty || 0);
            await updateRow('products', rowIdx + 1, allRows[rowIdx].map((v, i) => i === stockIdx ? String(newStock) : v));
            allRows[rowIdx][stockIdx] = String(newStock);
          }
        }
      }

      return res.json({ success: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;

// Start server regardless — ensureInit() retries lazily on each request
app.listen(PORT, () => {
  console.log(`✅ POS-Sheet server running at http://localhost:${PORT}`);
  console.log(`   Spreadsheet ID: ${SPREADSHEET_ID}`);
  // Warm-up: test Sheets connection at startup
  initSheets()
    .then(() => console.log('✅ Google Sheets connected OK'))
    .catch(err => console.error('⚠️  Google Sheets init failed (will retry per request):', err.message));
});
