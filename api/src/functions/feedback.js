// Tabi Studio feedback API
// Serverless HTTP function: POST /api/feedback
// Saves one feedback entry per request into Azure Table Storage (table: "feedback").

const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

// Only these app names are accepted, so random junk can't create new partitions.
const ALLOWED_APPS = ['Runling', 'MT App', 'SyntaxDeck', 'Calm Crew', 'Website'];

app.http('feedback', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    // 1. Read the JSON body
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { error: 'Body must be valid JSON.' } };
    }

    // 2. Validate input (trim and cap lengths)
    const appName = String(body.app || '').trim();
    const message = String(body.message || '').trim().slice(0, 2000);

    if (!ALLOWED_APPS.includes(appName) || !message) {
      return {
        status: 400,
        jsonBody: { error: `Send {"app": one of ${ALLOWED_APPS.join(', ')}, "message": "..."}` }
      };
    }

    // 3. Save to Table Storage.
    // The connection string comes from an app setting, never from the code (this repo is public).
    const connectionString = process.env.STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      context.error('STORAGE_CONNECTION_STRING is not set.');
      return { status: 500, jsonBody: { error: 'Server is not configured.' } };
    }

    const table = TableClient.fromConnectionString(connectionString, 'feedback');
    const now = new Date();

    await table.createEntity({
      partitionKey: appName, // groups feedback by app
      rowKey: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, // unique per entry
      message,
      submittedAt: now.toISOString()
    });

    context.log(`Feedback saved for ${appName}`);
    return { status: 201, jsonBody: { ok: true, message: 'Thanks for the feedback!' } };
  }
});
