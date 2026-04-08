function Navbar({ themeMode, onToggleTheme }) {
  return (
    <nav className="navbar navbar-expand-lg shadow-sm app-navbar">
      <div className="container navbar-shell">
        <div className="d-flex flex-column navbar-brand-block">
          <span className="navbar-brand fw-bold">SkyCast</span>
          <small className="text-navbar-subtle">Weather Portal</small>
        </div>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse navbar-main" id="navbarNav">
          <ul className="navbar-nav navbar-links">
            <li className="nav-item">
              <a className="nav-link" href="#home">
                Home
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#prediction">
                Search
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#forecast">
                Forecast
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link" href="#models">
                Models
              </a>
            </li>
          </ul>

          <div className="navbar-actions">
            <button
              type="button"
              className="theme-toggle-button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}
            >
              <span className="theme-toggle-icon">{themeMode === "dark" ? "L" : "D"}</span>
              <span>{themeMode === "dark" ? "Light Mode" : "Dark Mode"}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
