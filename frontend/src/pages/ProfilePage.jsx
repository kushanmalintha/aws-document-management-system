import { useEffect, useState } from "react";
import { useAuth } from "../context/authContext";
import { getApiErrorMessage } from "../services/api";
import { getUserProfile, updateUserProfile } from "../services/userService";
import "../styles/profile.css";

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ProfilePage() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    getUserProfile()
      .then((userProfile) => {
        if (!active) return;
        setProfile(userProfile);
        setDisplayName(userProfile.display_name ?? "");
        updateUser(userProfile);
      })
      .catch((requestError) => {
        if (!active) return;
        setLoadError(
          getApiErrorMessage(
            requestError,
            "Unable to load your profile. Please try again.",
          ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, updateUser]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaveError("");
    setSaveSuccess("");

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setSaveError("Display name cannot be empty.");
      return;
    }

    setSaving(true);

    try {
      const updatedProfile = await updateUserProfile({
        display_name: trimmedName,
      });
      setProfile(updatedProfile);
      setDisplayName(updatedProfile.display_name);
      updateUser(updatedProfile);
      setSaveSuccess("Profile updated successfully.");
    } catch (requestError) {
      setSaveError(
        getApiErrorMessage(
          requestError,
          "Unable to update your profile. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-page">
      <header className="profile-page__header">
        <div>
          <p className="profile-page__eyebrow">Workspace</p>
          <h1>Profile</h1>
          <p>View your account details and update your display name.</p>
        </div>
      </header>

      {loading && (
        <div className="profile-state" role="status">
          Loading profile…
        </div>
      )}

      {!loading && loadError && (
        <div className="profile-state profile-state--error" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !loadError && profile && (
        <div className="profile-grid">
          <form className="profile-card" onSubmit={handleSubmit}>
            <h2>Personal information</h2>

            <div className="profile-field">
              <label htmlFor="profile-display-name">Display name</label>
              <input
                id="profile-display-name"
                name="display_name"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSaveError("");
                  setSaveSuccess("");
                }}
                maxLength={255}
                required
                disabled={saving}
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-email">Email address</label>
              <input
                id="profile-email"
                type="email"
                value={profile.email || ""}
                readOnly
              />
            </div>

            {saveError && (
              <p className="profile-message profile-message--error" role="alert">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="profile-message profile-message--success" role="status">
                {saveSuccess}
              </p>
            )}

            <button className="profile-submit" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </form>

          <section className="profile-card" aria-labelledby="profile-account-title">
            <h2 id="profile-account-title">Account details</h2>
            <dl className="profile-details">
              <div>
                <dt>Account ID</dt>
                <dd>{profile.id}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{profile.role || "Unavailable"}</dd>
              </div>
              <div>
                <dt>Account status</dt>
                <dd>{profile.is_active ? "Active" : "Inactive"}</dd>
              </div>
              <div>
                <dt>Joined</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(profile.updated_at)}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
