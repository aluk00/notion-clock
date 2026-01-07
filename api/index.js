const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB_ID = process.env.NOTION_PROJECTS_DB;

let dataSourceId = null;

async function getDataSourceId() {
  if (dataSourceId) return dataSourceId;
  try {
    const db = await notion.databases.retrieve({ database_id: DB_ID });
    if (db.data_sources && db.data_sources.length > 0) {
      dataSourceId = db.data_sources[0].id;
    } else {
      dataSourceId = DB_ID;
    }
  } catch (e) {
    dataSourceId = DB_ID;
  }
  return dataSourceId;
}

app.get("/", (req, res) => res.json({ status: "ok", version: "6.0.0" }));

app.get("/projects", async (req, res) => {
  try {
    const dsId = await getDataSourceId();
    const response = await notion.request({
      path: `/v1/data_sources/${dsId}/query`,
      method: "POST",
      body: {}
    });
    const projects = response.results.map(p => {
      const title = p.properties["Project Name"];
      const client = p.properties["Client"];
      return {
        id: p.id,
        title: title && title.title && title.title[0] ? title.title[0].plain_text : "",
        client: client && client.rich_text && client.rich_text[0] ? client.rich_text[0].plain_text : "",
        url: p.url
      };
    });
    res.json({ success: true, projects: projects });
  } catch (e) {
    console.error("GET /projects error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/projects", async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) return res.status(400).json({ error: "Title required" });
    const dsId = await getDataSourceId();
    const props = { "Project Name": { title: [{ text: { content: b.title } }] } };
    if (b.client) props["Client"] = { rich_text: [{ text: { content: b.client } }] };
    if (b.projectType) props["Project Type"] = { select: { name: b.projectType } };
    if (b.priority) props["Priority"] = { select: { name: b.priority } };
    if (b.dueDate) props["Due Date"] = { date: { start: b.dueDate } };
    if (b.dealStage) props["Deal Stage"] = { select: { name: b.dealStage } };
    if (b.dealValue) props["Deal Value"] = { number: b.dealValue };
    if (b.notes) props["Notes"] = { rich_text: [{ text: { content: b.notes } }] };
    const result = await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: dsId },
      properties: props
    });
    res.json({ success: true, id: result.id, url: result.url });
  } catch (e) {
    console.error("POST /projects error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/staff", async (req, res) => {
  try {
    const data = await notion.users.list({});
    const users = data.results.filter(u => u.type === "person").map(u => ({ id: u.id, name: u.name }));
    res.json({ success: true, users: users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on " + PORT));
