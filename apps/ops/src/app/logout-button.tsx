"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <button className="linkButton" onClick={() => void logout()} type="button">
      退出登录
    </button>
  );
}
