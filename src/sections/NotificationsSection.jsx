function NotificationsSection({ notifications, onMarkNotificationsRead, unreadCount, user }) {
  return (
    <section id="notifications" className="mb-5">
      <div className="card p-4 shadow-lg border-0 rounded-4">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h3 className="mb-1">Notifications</h3>
            <p className="mb-0 text-muted">
              Weather alerts, account activity, and saved prediction updates.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="badge text-bg-warning">{unreadCount} unread</span>
            {user ? (
              <button
                className="btn btn-outline-dark btn-sm"
                onClick={onMarkNotificationsRead}
                type="button"
              >
                Mark all read
              </button>
            ) : null}
          </div>
        </div>

        {user ? (
          notifications.length ? (
            <div className="notifications-board">
              {notifications.map((item) => (
                <div
                  className={`notification-board-card ${item.is_read ? "read" : "unread"}`}
                  key={item.id}
                >
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-0 text-muted">No notifications yet.</p>
          )
        ) : (
          <p className="mb-0 text-muted">Login to view personal weather notifications.</p>
        )}
      </div>
    </section>
  );
}

export default NotificationsSection;
