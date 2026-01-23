import axios from "axios";

const http = axios.create({
  timeout: 15000,
  maxRedirects: 2,
  headers: {
    "User-Agent": "WA-BOT-STB/1.0",
  },
});

export default http;
