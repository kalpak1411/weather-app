import { useState } from "react";

function AuthGateway({ authError, onEnterGuestMode, onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    city: "",
    country: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    if (mode === "login") {
      await onLogin(formData.username, formData.password);
    } else {
      await onRegister(formData);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="auth-gateway-shell">
      <div className="auth-gateway-card">
        <div className="auth-gateway-copy">
          <span className="auth-kicker">Weather Prediction System</span>
          <h1>{mode === "login" ? "Login to continue" : "Create your account"}</h1>
          <p>
            Sign in to save forecasts, receive notifications, and manage weather
            activity. If you just want to explore, you can skip and continue as a guest.
          </p>
        </div>

        <form className="auth-gateway-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          {mode === "register" ? (
            <div className="register-grid">
              <input
                className="form-control form-control-lg"
                onChange={(event) => updateField("firstName", event.target.value)}
                placeholder="First name"
                value={formData.firstName}
              />
              <input
                className="form-control form-control-lg"
                onChange={(event) => updateField("lastName", event.target.value)}
                placeholder="Last name"
                value={formData.lastName}
              />
              <input
                className="form-control form-control-lg register-span"
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="Email address"
                type="email"
                value={formData.email}
              />
              <input
                className="form-control form-control-lg"
                onChange={(event) => updateField("phoneNumber", event.target.value)}
                placeholder="Phone number"
                value={formData.phoneNumber}
              />
              <input
                className="form-control form-control-lg"
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="City"
                value={formData.city}
              />
              <input
                className="form-control form-control-lg register-span"
                onChange={(event) => updateField("country", event.target.value)}
                placeholder="Country"
                value={formData.country}
              />
            </div>
          ) : null}

          <input
            className="form-control form-control-lg"
            onChange={(event) => updateField("username", event.target.value)}
            placeholder="Username"
            value={formData.username}
          />
          <input
            className="form-control form-control-lg"
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="Password"
            type="password"
            value={formData.password}
          />

          <button className="btn btn-warning btn-lg w-100" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Login"
                : "Register"}
          </button>

          {authError ? <div className="auth-error-box">{authError}</div> : null}

          <button
            className="btn btn-outline-light btn-lg w-100"
            onClick={onEnterGuestMode}
            type="button"
          >
            Skip for now
          </button>

          <small className="auth-helper-text">
            Your registration now stores profile details in the database.
          </small>
        </form>
      </div>
    </div>
  );
}

export default AuthGateway;
