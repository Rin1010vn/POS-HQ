// update_headers.js
// Usage: node update_headers.js
// This will update the header row (A1:Z1) on the 'products' sheet to include
// id, name, group, supplier, cost, price, stock

const { google } = require('googleapis');
require('dotenv').config();

async function main() {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
  const KEYFILE = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!SPREADSHEET_ID) {
    console.error('SPREADSHEET_ID not set in .env');
    process.exit(1);
  }
  if (!KEYFILE) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS not set in .env');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({ keyFile: KEYFILE, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const headers = ['id','name','group','supplier','cost','price','stock'];

  try {
    const range = 'products!A1:' + String.fromCharCode('A'.charCodeAt(0) + headers.length - 1) + '1';
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'RAW',
      resource: { values: [headers] }
    });
    console.log('Updated headers on products sheet to:', headers.join(', '));
    console.log('Update response status:', res.status);
  } catch (err) {
    console.error('Failed to update headers:', err.message || err);
    process.exit(2);
  }
}

main();
