import "dotenv/config.js";
import app from "./src/app.js";
import { connectToDb } from "./src/config/database.js";

connectToDb();
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server runing on ${PORT}`);
});
