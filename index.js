const fs = require("fs");
const { google } = require("googleapis");
const path = require("path");

async function main() {
  // 1. Load OAuth2 credentials
  const credentials = require("./credentials.json");
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // 2. Check if token already exists
  const tokenPath = path.join(__dirname, "token.json");

  if (fs.existsSync(tokenPath)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath)));
    return createGoogleForm(oAuth2Client);
  }

  // 3. Create auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/forms.body"],
  });

  console.log("\n👉 Authorize this app by visiting this URL:\n");
  console.log(authUrl);

  console.log("\nAfter you login, Google will give you a code.");
  console.log("Paste the code here:\n");

  // 4. Read code from terminal
  process.stdin.resume();
  process.stdin.on("data", (data) => {
    const code = data.toString().trim();
    process.stdin.pause();

    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error("Error retrieving access token", err);

      // save token for future
      fs.writeFileSync(tokenPath, JSON.stringify(token));
      oAuth2Client.setCredentials(token);

      createGoogleForm(oAuth2Client);
    });
  });
}

async function createGoogleForm(auth) {
  const forms = google.forms({ version: "v1", auth });

  const formJson = require("./form.json");

  console.log("\n📌 Creating form…");

  try {
    // Step 1: Create form with only title
    const res = await forms.forms.create({
      requestBody: {
        info: {
          title: formJson.info.title,
        },
      },
    });

    const formId = res.data.formId;
    console.log("✅ Form created with ID:", formId);

    // Step 2: Add all items via batchUpdate
    console.log("📌 Adding form items…");
    const requests = formJson.items.map((item, index) => ({
      createItem: {
        item: item,
        location: {
          index: index,
        },
      },
    }));

    await forms.forms.batchUpdate({
      formId: formId,
      requestBody: {
        requests: requests,
      },
    });

    console.log("✅ All items added successfully!");
    console.log("\n🎉 Form created successfully!");
    console.log("\n👉 Form Edit URL:");
    console.log(`https://docs.google.com/forms/d/${formId}/edit`);
  } catch (err) {
    console.error("\n❌ Error creating form:");
    console.error(err);
  }
}

main();
