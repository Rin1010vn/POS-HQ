Google Sheets bridge server (Service Account)

Overview

This repository contains a minimal Node.js Express server that exposes a single `/api` endpoint compatible with the front-end `2.html` you provided. It uses a Google Service Account to read/write three sheets named `products`, `customers`, and `orders` in a target spreadsheet.

Preparation

1. Create a Google Spreadsheet and add three sheets (tabs) with these header rows (first row):
   - `products`: id,name,cost,price,stock
   - `customers`: id,name,phone,address,coords
   - `orders`: id,time,customerName,customerId,total,cost,profit,items

2. Create a Google Cloud project and enable the "Google Sheets API".
3. Create a Service Account, then create and download a JSON key file.
4. Share the spreadsheet with the service account email (the JSON contains a client_email) with Editor permission.

Setup (local)

1. Place the JSON keyfile somewhere on your machine, e.g. `C:\keys\sa.json`.
2. Create a `.env` file next to `server/index.js` with:

SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_APPLICATION_CREDENTIALS=C:\keys\sa.json
PORT=3000

3. Install dependencies and start the server:

```bash
cd C:\Users\Rin\Desktop\pos-sheet-server\server
npm install
npm start
```

4. Update your front-end `2.html`: set `SCRIPT_URL` to your server address, e.g. `http://localhost:3000/api`.

Notes

- The server assumes header rows exactly match the column names above. It appends/updates/deletes rows by searching the `id` column.
- For production, secure the endpoint (authentication) — the example is minimal for local testing.

If you want, tôi có thể hướng dẫn chi tiết từng bước tạo Service Account và chia sẻ spreadsheet, hoặc tôi có thể tạo một bản Apps Script thay vì server (nếu bạn muốn host trực tiếp trên Google).