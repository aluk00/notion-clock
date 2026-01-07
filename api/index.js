const express = require("express");
const cors = require("cors");
const { Client } = require("@notionhq/client");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DB = process.env.NOTION_PROJECTS_DB;

app.get("/", (req, res) => res.json({ status: "ok" }));

app.get("/projects", async (req, res) => {
  try {
    const data = await notion.databases.query({ database_id: DB });
    const projects = data.results.map(p => {
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
    res.status(500).json({ error: e.message });
  }
});

app.post("/projects", async (req, res) => {
  try {
    const b = req.body;
    if (!b.title) return res.status(400).json({ error: "Title required" });
    const props = { "Project Name": { title: [{ text: { content: b.title } }] } };
    if (b.client) props["Client"] = { rich_text: [{ text: { content: b.client } }] };
    if (b.projectType) props["Project Type"] = { select: { name: b.projectType } };
    if (b.priority) props["Priority"] = { select: { name: b.priority } };
    if (b.dueDate) props["Due Date"] = { date: { start: b.dueDate } };
    if (b.dealStage) props["Deal Stage"] = { select: { name: b.dealStage } };
    if (b.dealValue) props["Deal Value"] = { number: b.dealValue };
    if (b.notes) props["Notes"] = { rich_text: [{ text: { content: b.notes } }] };
    const result = await notion.pages.create({ parent: { database_id: DB }, properties: props });
    res.json({ success: true, id: result.id, url: result.url });
  } catch (e) {
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