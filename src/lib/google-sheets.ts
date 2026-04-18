import { google } from "googleapis";

function getAuth() {
  let email = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const decodedStr = Buffer.from(process.env.GCP_SERVICE_ACCOUNT_KEY, "base64").toString("utf-8");
      // Fallback decode if it wasn't base64 but just raw JSON
      const jsonStr = decodedStr.trim().startsWith('{') ? decodedStr : process.env.GCP_SERVICE_ACCOUNT_KEY;
      const parsed = JSON.parse(jsonStr);
      email = parsed.client_email;
      privateKey = parsed.private_key?.replace(/\\n/g, "\n");
    } catch (err) {
      console.error("Failed to parse GCP_SERVICE_ACCOUNT_KEY:", err);
    }
  }

  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account credentials. Please set GCP_SERVICE_ACCOUNT_KEY.");
  }

  return new google.auth.JWT(
    email,
    undefined,
    privateKey,
    [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets",
    ]
  );
}

export async function exportToGoogleSheet(title: string, data: Record<string, any>[], folderId: string) {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Create Spreadsheet in the specified Drive folder
  const fileMetadata = {
    name: title,
    mimeType: "application/vnd.google-apps.spreadsheet",
    parents: [folderId],
  };

  const file = await drive.files.create({
    requestBody: fileMetadata,
    fields: "id, webViewLink",
  });

  const spreadsheetId = file.data.id;
  if (!spreadsheetId) {
    throw new Error("Failed to create Google Spreadsheet");
  }

  // 2. Format Data into a 2D Array for Sheets
  if (data && data.length > 0) {
    const keys = Object.keys(data[0]);
    const rows = [
      keys,
      ...data.map((row) => keys.map((k) => (row[k] === undefined || row[k] === null ? "" : String(row[k])))),
    ];

    // 3. Write Data to the Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: rows,
      },
    });
  }

  return file.data.webViewLink;
}
