import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api`,
  timeout: 20_000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error("Check internet connection and retry");
    }
    return Promise.reject(error);
  },
);

export default api;
