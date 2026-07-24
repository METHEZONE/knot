import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const port = Number(process.env.PORT ?? "8082");
const app = createApp(loadConfig());

app.listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ severity: "INFO", service: "knot-web3", port }));
});
