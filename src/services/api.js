import axios from "axios";

const browserHost = window.location.hostname || "localhost";
const isLocalHost = browserHost === "localhost" || browserHost === "127.0.0.1";
export const apiBaseUrl = isLocalHost ? "http://localhost:8000" : window.location.origin;

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

export const getCurrentUser = () => api.get("/api/auth/me/");

export const loginUser = (username, password) => {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  return api.post("/api/auth/login/", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const registerUser = ({
  username,
  password,
  firstName,
  lastName,
  email,
  phoneNumber,
  city,
  country,
}) => {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);
  formData.append("first_name", firstName);
  formData.append("last_name", lastName);
  formData.append("email", email);
  formData.append("phone_number", phoneNumber);
  formData.append("city", city);
  formData.append("country", country);

  return api.post("/api/auth/register/", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const logoutUser = () => api.post("/api/auth/logout/");

export const fetchNotifications = () => api.get("/api/notifications/");

export const markNotificationsRead = () =>
  api.post("/api/notifications/mark-read/");

export const fetchSavedPredictions = () => api.get("/api/saved-predictions/");

export const fetchSmsPreferences = () => api.get("/api/sms/preferences/");

export const updateSmsPreferences = ({ phoneNumber, smsNotificationsEnabled }) => {
  const formData = new URLSearchParams();
  formData.append("phone_number", phoneNumber);
  formData.append("sms_notifications_enabled", String(smsNotificationsEnabled));

  return api.post("/api/sms/preferences/update/", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const sendTestSms = () => api.post("/api/sms/send-test/");

export const addFavoriteCity = (city) => {
  const formData = new URLSearchParams();
  formData.append("city", city);

  return api.post("/api/favorite-cities/", formData, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

export const fetchWeather = (city) =>
  api.get("/fetch-weather/", {
    params: { city },
  });

export const fetchPrediction = (city, date, options = {}) =>
  api.get("/api/smart-predict/", {
    params: {
      city,
      date,
      phone_number: options.phoneNumber || "",
      sms_alerts_enabled: options.smsAlertsEnabled || false,
    },
  });

export default api;
