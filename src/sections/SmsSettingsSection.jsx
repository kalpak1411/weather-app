import { useEffect, useState } from "react";
import {
  fetchSmsPreferences,
  sendTestSms,
  updateSmsPreferences,
} from "../services/api";

function SmsSettingsSection({ onRefreshUser, user }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [logs, setLogs] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const isAdmin = Boolean(user?.is_staff);

  const loadPreferences = async () => {
    const response = await fetchSmsPreferences();
    const preferences = response.data.sms_preferences || {};
    setPhoneNumber(preferences.phone_number || "");
    setSmsEnabled(Boolean(preferences.sms_notifications_enabled));
    setPhoneVerified(Boolean(preferences.phone_verified));
    setLogs(response.data.recent_sms_logs || []);
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    loadPreferences().catch((error) => {
      console.error(error);
    });
  }, [user]);

  if (!user) {
    return (
      <section id="sms-settings" className="mb-5">
        <div className="card p-4 shadow-lg border-0 rounded-4">
          <h3 className="mb-3">SMS Notifications</h3>
          <p className="mb-0 text-muted">
            Login to manage phone number alerts.
          </p>
        </div>
      </section>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage("");

    try {
      await updateSmsPreferences({
        phoneNumber,
        smsNotificationsEnabled: smsEnabled,
      });
      await loadPreferences();
      await onRefreshUser();
      setStatusMessage("SMS settings saved successfully.");
    } catch (error) {
      console.error(error);
      setStatusMessage(error.response?.data?.error || "Unable to save SMS settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setStatusMessage("");

    try {
      const response = await sendTestSms();
      setLogs(response.data.recent_sms_logs || []);
      setStatusMessage(response.data.message || "Test SMS sent successfully.");
    } catch (error) {
      console.error(error);
      setLogs(error.response?.data?.recent_sms_logs || logs);
      setStatusMessage(
        error.response?.data?.error || "Unable to send a test SMS right now."
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  return (
    <section id="sms-settings" className="mb-5">
      <div className="card p-4 shadow-lg border-0 rounded-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h3 className="mb-0">SMS Notifications</h3>
          <span className={`badge ${phoneVerified ? "text-bg-success" : "text-bg-secondary"}`}>
            {phoneVerified ? "Phone Verified" : "Phone Not Verified"}
          </span>
        </div>

        <div className="row g-3 align-items-end">
          <div className="col-md-6">
            <label className="form-label">Phone Number</label>
            <input
              className="form-control"
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+91 9876543210"
              value={phoneNumber}
            />
          </div>
          <div className="col-md-3">
            <div className="form-check sms-toggle">
              <input
                checked={smsEnabled}
                className="form-check-input"
                id="smsEnabled"
                onChange={(event) => setSmsEnabled(event.target.checked)}
                type="checkbox"
              />
              <label className="form-check-label" htmlFor="smsEnabled">
                Enable SMS alerts
              </label>
            </div>
          </div>
          <div className="col-md-3">
            <button className="btn btn-warning w-100" onClick={handleSave} type="button">
              {isSaving ? "Saving..." : "Save SMS Settings"}
            </button>
          </div>
        </div>

        <div className="mt-3 d-flex justify-content-end">
          <button
            className="btn btn-outline-light"
            disabled={isSendingTest}
            onClick={handleSendTest}
            type="button"
          >
            {isSendingTest ? "Sending Test SMS..." : "Send Test SMS"}
          </button>
        </div>

        {statusMessage ? <div className="status-banner mt-3">{statusMessage}</div> : null}

        {isAdmin ? (
          <div className="mt-4">
            <h5 className="mb-3">Recent SMS Logs</h5>
            {logs.length ? (
              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Status</th>
                      <th>Phone</th>
                      <th>Message</th>
                      <th>Error</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((item) => (
                      <tr key={item.id}>
                        <td>{item.username || "-"}</td>
                        <td>{item.status}</td>
                        <td>{item.phone_number}</td>
                        <td>{item.message}</td>
                        <td>{item.error_message || "-"}</td>
                        <td>{new Date(item.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mb-0 text-muted">No SMS logs yet.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default SmsSettingsSection;
