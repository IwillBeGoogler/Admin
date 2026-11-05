// Applies the saved theme before first paint (no flash). External file so the CSP needs no inline script.
(() => {
  try {
    const t = localStorage.getItem("admin.theme");
    if (t === "dark" || (!t && matchMedia("(prefers-color-scheme: dark)").matches))
      document.documentElement.classList.add("dark");
  } catch {}
})();
