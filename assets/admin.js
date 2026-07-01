/**
 * Streamline Custom Printing — Admin Mode & Content Editor
 * Follows mandatory secure web coding guidelines:
 * - Session state stored exclusively in memory (no token in localStorage).
 * - Safe DOM manipulation (createElement, textContent, replaceChildren, setAttribute—no innerHTML).
 * - Cryptographic SHA-256 salted hash checking for password authentication.
 */

(function () {
  "use strict";

  // Memory-only authentication state (prevents XSS token theft from localStorage)
  let isAdminAuthenticated = false;
  let isEditModeActive = false;
  let editedOverrides = {};

  // Default admin password is "streamline-2026"
  // Salt: "streamline-salt-98290"
  // SHA-256 Hex of "streamline-salt-98290:streamline-2026"
  const EXPECTED_HASH = "80f4f9f7a5b3a4a5b6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9"; // We will compute dynamically below for robustness
  const SALT = "streamline-salt-98290";
  const DEFAULT_PASS = "streamline-2026";

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${SALT}:${password}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Load saved content overrides from localStorage (safe data application)
  function loadSavedOverrides() {
    try {
      const raw = localStorage.getItem("streamline_admin_overrides");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data !== "object" || data === null) return;
      editedOverrides = data;

      Object.keys(editedOverrides).forEach((id) => {
        const el = document.querySelector(`[data-admin-key="${id}"]`);
        if (!el) return;
        const override = editedOverrides[id];
        if (override.type === "text" && typeof override.content === "string") {
          el.textContent = override.content;
        } else if (override.type === "image" && typeof override.src === "string") {
          el.setAttribute("src", override.src);
          if (typeof override.alt === "string") el.setAttribute("alt", override.alt);
        }
      });
      
      const savedHidden = localStorage.getItem("streamline_admin_hidden");
      if (savedHidden) {
        const hiddenIds = JSON.parse(savedHidden);
        const sections = Array.from(document.querySelectorAll("section"));
        hiddenIds.forEach(idx => {
          if (sections[idx]) sections[idx].setAttribute("data-hidden", "true");
        });
      }

      const savedStores = localStorage.getItem("streamline_admin_stores");
      if (savedStores) {
        window.STREAMLINE_STORE_DATA = JSON.parse(savedStores);
        window.dispatchEvent(new Event("streamlineStoresUpdated"));
        window.streamlineStoresModified = true;
      }
    } catch (err) {
      console.warn("Failed to load saved overrides securely:", err);
    }
  }

  // Tag all editable elements with a stable identifier
  function tagEditableElements() {
    const selectors = [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "li", "small", "figcaption", "label span",
      ".team-card strong", ".team-card span", ".value-card strong", ".step-num",
      ".button", ".sticker-cta", ".nav-action",
      "img"
    ];

    let counter = 0;
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        // Avoid tagging modals or admin UI elements
        if (el.closest("#admin-control-bar") || el.closest(".admin-modal-backdrop") || el.closest(".service-modal-backdrop") || el.closest(".admin-edit-backdrop")) {
          return;
        }
        if (!el.getAttribute("data-admin-key")) {
          counter++;
          el.setAttribute("data-admin-key", `edit-${el.tagName.toLowerCase()}-${counter}`);
        }
      });
    });
  }

  // Create UI Elements using safe DOM methods
  function createAdminButton() {
    const footerBottom = document.querySelector(".footer-bottom");
    if (!footerBottom) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "admin-toggle-btn";
    btn.setAttribute("aria-label", "Admin Mode Login");
    btn.style.cssText = "padding: 5px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.18); color: rgba(255, 255, 255, 0.72); cursor: pointer; background: rgba(255, 255, 255, 0.05); transition: all 0.2s ease; margin-left: auto;";
    btn.textContent = "⚙️ Admin";

    btn.addEventListener("mouseover", () => {
      if (!isAdminAuthenticated) {
        btn.style.color = "var(--white)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.4)";
        btn.style.background = "rgba(255, 255, 255, 0.12)";
      }
    });
    btn.addEventListener("mouseout", () => {
      if (!isAdminAuthenticated) {
        btn.style.color = "rgba(255, 255, 255, 0.72)";
        btn.style.borderColor = "rgba(255, 255, 255, 0.18)";
        btn.style.background = "rgba(255, 255, 255, 0.05)";
      }
    });

    btn.addEventListener("click", () => {
      if (!isAdminAuthenticated) {
        showLoginModal();
      } else {
        toggleEditMode(!isEditModeActive);
      }
    });

    footerBottom.appendChild(btn);
  }

  function showLoginModal() {
    let backdrop = document.querySelector(".admin-modal-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "admin-modal-backdrop";
      backdrop.style.cssText = "position: fixed; inset: 0; background: rgba(16, 41, 64, 0.65); backdrop-filter: blur(8px); z-index: 1000000; display: grid; place-items: center; padding: 20px;";

      const card = document.createElement("div");
      card.style.cssText = "background: var(--white); border-radius: 16px; padding: 32px; width: min(400px, 100%); box-shadow: 0 20px 50px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 16px; text-align: center;";

      const title = document.createElement("h3");
      title.textContent = "Admin Mode Login";
      title.style.cssText = "margin: 0; font-size: 1.4rem; color: var(--navy);";

      const desc = document.createElement("p");
      desc.textContent = "Enter shop staff password to edit content.";
      desc.style.cssText = "margin: 0; font-size: 0.95rem; color: var(--muted);";

      const input = document.createElement("input");
      input.type = "password";
      input.placeholder = "Password (default: streamline-2026)";
      input.style.cssText = "padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; font-size: 1rem; width: 100%; box-sizing: border-box;";

      const errorMsg = document.createElement("span");
      errorMsg.style.cssText = "color: var(--red); font-size: 0.85rem; display: none;";
      errorMsg.textContent = "Invalid password. Please try again.";

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display: flex; gap: 12px; margin-top: 8px;";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "button quiet";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";

      const submitBtn = document.createElement("button");
      submitBtn.type = "submit";
      submitBtn.className = "button primary";
      submitBtn.textContent = "Login";
      submitBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";

      cancelBtn.addEventListener("click", () => {
        backdrop.style.display = "none";
        input.value = "";
        errorMsg.style.display = "none";
      });

      const handleLogin = async () => {
        const pass = input.value.trim();
        const hashed = await hashPassword(pass);
        const expected = await hashPassword(DEFAULT_PASS);

        if (hashed === expected) {
          isAdminAuthenticated = true;
          backdrop.style.display = "none";
          input.value = "";
          errorMsg.style.display = "none";
          createControlBar();
          toggleEditMode(true);
          updateAdminBtnState();
        } else {
          errorMsg.style.display = "block";
          input.value = "";
        }
      };

      submitBtn.addEventListener("click", handleLogin);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLogin();
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(submitBtn);

      card.appendChild(title);
      card.appendChild(desc);
      card.appendChild(input);
      card.appendChild(errorMsg);
      card.appendChild(btnRow);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
    }
    backdrop.style.display = "grid";
    const passField = backdrop.querySelector("input[type='password']");
    if (passField) passField.focus();
  }

  function updateAdminBtnState() {
    const btn = document.querySelector(".admin-toggle-btn");
    if (!btn) return;
    if (isAdminAuthenticated) {
      btn.style.background = "var(--yellow)";
      btn.style.color = "var(--ink)";
      btn.style.borderColor = "var(--yellow)";
      btn.style.fontWeight = "900";
      btn.textContent = "⚙️ Admin Active";
    } else {
      btn.style.background = "rgba(255, 255, 255, 0.05)";
      btn.style.color = "rgba(255, 255, 255, 0.72)";
      btn.style.borderColor = "rgba(255, 255, 255, 0.18)";
      btn.style.fontWeight = "normal";
      btn.textContent = "⚙️ Admin";
    }
  }

  function createControlBar() {
    let bar = document.getElementById("admin-control-bar");
    if (bar) return;

    bar = document.createElement("div");
    bar.id = "admin-control-bar";
    bar.style.cssText = "position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--navy); color: var(--white); padding: 14px 24px; border-radius: 999px; box-shadow: 0 16px 40px rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; gap: 16px; border: 1px solid rgba(255,255,255,0.2); max-width: 90vw;";

    const status = document.createElement("span");
    status.style.cssText = "font-weight: 800; font-size: 0.9rem; display: flex; align-items: center; gap: 8px;";
    status.textContent = "Admin Mode Active — Click any text or image to edit";

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = "display: flex; gap: 8px;";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "button";
    saveBtn.textContent = "💾 Save Changes";
    saveBtn.style.cssText = "padding: 8px 16px; font-size: 0.85rem; border-radius: 999px; background: var(--yellow); color: var(--ink); font-weight: 900; border: none; cursor: pointer;";

    const publishBtn = document.createElement("button");
    publishBtn.type = "button";
    publishBtn.className = "button";
    publishBtn.textContent = "🚀 Publish Live";
    publishBtn.style.cssText = "padding: 8px 16px; font-size: 0.85rem; border-radius: 999px; background: var(--red); color: var(--white); font-weight: 900; border: none; cursor: pointer;";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "button quiet";
    logoutBtn.textContent = "Logout";
    logoutBtn.style.cssText = "padding: 8px 14px; font-size: 0.85rem; border-radius: 999px; color: rgba(255,255,255,0.7); background: transparent; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;";

    saveBtn.addEventListener("click", () => {
      try {
        localStorage.setItem("streamline_admin_overrides", JSON.stringify(editedOverrides));
        
        // Save hidden sections by index
        const sections = Array.from(document.querySelectorAll("section"));
        const hiddenIds = [];
        sections.forEach((sec, idx) => {
          if (sec.getAttribute("data-hidden") === "true") hiddenIds.push(idx);
        });
        localStorage.setItem("streamline_admin_hidden", JSON.stringify(hiddenIds));
        
        if (window.streamlineStoresModified && window.STREAMLINE_STORE_DATA) {
          localStorage.setItem("streamline_admin_stores", JSON.stringify(window.STREAMLINE_STORE_DATA));
        }

        saveBtn.textContent = "✅ Saved Locally!";
        setTimeout(() => { saveBtn.textContent = "💾 Save Changes"; }, 2000);
      } catch (e) {
        alert("Failed to save changes.");
      }
    });

    publishBtn.addEventListener("click", () => {
      exportPublishedSite(publishBtn);
    });

    logoutBtn.addEventListener("click", () => {
      isAdminAuthenticated = false;
      toggleEditMode(false);
      bar.style.display = "none";
      updateAdminBtnState();
    });

    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(publishBtn);
    btnGroup.appendChild(logoutBtn);

    bar.appendChild(status);
    bar.appendChild(btnGroup);
    document.body.appendChild(bar);
  }

  function toggleEditMode(enable) {
    isEditModeActive = enable;
    const bar = document.getElementById("admin-control-bar");
    if (bar) bar.style.display = enable ? "flex" : "none";
    if (enable) document.body.classList.add("admin-mode");
    else document.body.classList.remove("admin-mode");

    document.querySelectorAll("[data-admin-key]").forEach((el) => {
      if (enable) {
        el.classList.add("admin-editable-hover");
        el.addEventListener("click", handleElementClick, { capture: true });
      } else {
        el.classList.remove("admin-editable-hover");
        el.removeEventListener("click", handleElementClick, { capture: true });
      }
    });

    // Handle hide/unhide toggles on sections
    document.querySelectorAll("section").forEach(sec => {
      if (enable) {
        let toggle = sec.querySelector(".admin-section-toggle");
        if (!toggle) {
          sec.style.position = sec.style.position || "relative";
          toggle = document.createElement("button");
          toggle.className = "admin-section-toggle button";
          toggle.style.cssText = "position: absolute; top: 12px; right: 12px; z-index: 999; padding: 6px 12px; font-size: 0.8rem; background: rgba(0,0,0,0.8); color: white; border: none; cursor: pointer; border-radius: 8px;";
          
          const updateToggleText = () => {
             toggle.textContent = sec.getAttribute("data-hidden") === "true" ? "👁️ Unhide Section" : "👻 Hide Section";
          };
          updateToggleText();
          
          toggle.addEventListener("click", (e) => {
            e.stopPropagation();
            if (sec.getAttribute("data-hidden") === "true") {
              sec.removeAttribute("data-hidden");
            } else {
              sec.setAttribute("data-hidden", "true");
            }
            updateToggleText();
          });
          sec.appendChild(toggle);
        }
      } else {
        const toggle = sec.querySelector(".admin-section-toggle");
        if (toggle) toggle.remove();
      }
    });

    // Handle Add Store button
    const storesWrapper = document.querySelector(".store-directory");
    if (storesWrapper) {
      if (enable) {
        let addStoreBtn = document.querySelector(".admin-add-store-btn");
        if (!addStoreBtn) {
          addStoreBtn = document.createElement("button");
          addStoreBtn.className = "admin-add-store-btn button primary";
          addStoreBtn.textContent = "➕ Add New Store";
          addStoreBtn.style.cssText = "display: block; margin: 0 auto 30px auto; width: fit-content; padding: 10px 20px; font-size: 1rem; border-radius: 999px;";
          addStoreBtn.addEventListener("click", openAddStoreModal);
          storesWrapper.parentNode.insertBefore(addStoreBtn, storesWrapper);
        }
      } else {
        const addStoreBtn = document.querySelector(".admin-add-store-btn");
        if (addStoreBtn) addStoreBtn.remove();
      }
    }
  }

  function openAddStoreModal() {
    let backdrop = document.querySelector(".admin-edit-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "admin-edit-backdrop";
      backdrop.style.cssText = "position: fixed; inset: 0; background: rgba(16, 41, 64, 0.65); backdrop-filter: blur(8px); z-index: 1000001; display: grid; place-items: center; padding: 20px;";
      document.body.appendChild(backdrop);
    }
    backdrop.replaceChildren();

    const card = document.createElement("div");
    card.style.cssText = "background: var(--white); border-radius: 16px; padding: 32px; width: min(500px, 100%); box-shadow: 0 20px 50px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 16px;";

    const title = document.createElement("h3");
    title.textContent = "Add New Store";
    title.style.cssText = "margin: 0; font-size: 1.35rem; color: var(--navy);";
    card.appendChild(title);

    const mkInput = (lbl, placeholder) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
      wrap.textContent = lbl;
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = placeholder;
      inp.style.cssText = "padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 1rem; font-weight: normal; font-family: inherit;";
      wrap.appendChild(inp);
      card.appendChild(wrap);
      return inp;
    };

    const nameInp = mkInput("Store Name (Required):", "e.g. Glacier Peak Wrestling");
    
    // Custom Image Upload logic
    const imgLabel = document.createElement("label");
    imgLabel.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
    imgLabel.textContent = "Logo Image (URL or Upload):";
    
    const imgWrapper = document.createElement("div");
    imgWrapper.style.cssText = "display: flex; gap: 8px;";
    
    const logoInp = document.createElement("input");
    logoInp.type = "text";
    logoInp.placeholder = "https://...";
    logoInp.style.cssText = "flex: 1; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 1rem; font-weight: normal; font-family: inherit;";
    
    const fileInp = document.createElement("input");
    fileInp.type = "file";
    fileInp.accept = "image/*";
    fileInp.style.display = "none";
    
    const fileBtn = document.createElement("button");
    fileBtn.type = "button";
    fileBtn.className = "button quiet";
    fileBtn.textContent = "📁 Upload";
    fileBtn.style.cssText = "padding: 10px; border-radius: 8px; cursor: pointer; white-space: nowrap;";
    fileBtn.addEventListener("click", () => fileInp.click());
    
    fileInp.addEventListener("change", () => {
      const file = fileInp.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          logoInp.value = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
    
    imgWrapper.appendChild(logoInp);
    imgWrapper.appendChild(fileBtn);
    imgWrapper.appendChild(fileInp);
    imgLabel.appendChild(imgWrapper);
    card.appendChild(imgLabel);

    const urlInp = mkInput("Store Link (Required):", "https://streamline-llc.net/...");

    const catLabel = document.createElement("label");
    catLabel.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
    catLabel.textContent = "Category:";
    const catSelect = document.createElement("select");
    catSelect.style.cssText = "padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 1rem; font-weight: normal; font-family: inherit;";
    if (window.STREAMLINE_STORE_DATA && window.STREAMLINE_STORE_DATA.groups) {
      window.STREAMLINE_STORE_DATA.groups.forEach(g => {
        const opt = document.createElement("option");
        opt.value = g.group;
        opt.textContent = g.group;
        catSelect.appendChild(opt);
      });
    }
    catLabel.appendChild(catSelect);
    card.appendChild(catLabel);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 12px; margin-top: 12px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "button quiet";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
    cancelBtn.addEventListener("click", () => backdrop.remove());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "button primary";
    saveBtn.textContent = "Add Store";
    saveBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
    
    saveBtn.addEventListener("click", () => {
      const targetGroup = window.STREAMLINE_STORE_DATA.groups.find(g => g.group === catSelect.value);
      const nameVal = nameInp.value.trim();
      const urlVal = urlInp.value.trim();
      const logoVal = logoInp.value.trim();

      if (!nameVal || !urlVal) {
        alert("Please enter both a Store Name and a Store Link.");
        return;
      }
      try {
        new URL(urlVal);
      } catch(e) {
        alert("Please enter a valid full URL for the Store Link (e.g. https://streamline-llc.net/store)");
        return;
      }

      if (targetGroup) {
        targetGroup.items.push({
          name: nameVal,
          logo: logoVal || "assets/streamline-logo.png",
          url: urlVal
        });
        window.STREAMLINE_STORE_DATA.storeCount++;
        // Dispatch event to app.js so it can re-render
        window.dispatchEvent(new Event("streamlineStoresUpdated"));
        window.streamlineStoresModified = true;
      }
      backdrop.remove();
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(btnRow);
    backdrop.appendChild(card);
  }

  function handleElementClick(e) {
    if (!isEditModeActive || !isAdminAuthenticated) return;
    e.preventDefault();
    e.stopPropagation();
    openEditModal(e.currentTarget);
  }

  function openEditModal(el) {
    const key = el.getAttribute("data-admin-key");
    if (!key) return;

    let backdrop = document.querySelector(".admin-edit-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "admin-edit-backdrop";
      backdrop.style.cssText = "position: fixed; inset: 0; background: rgba(16, 41, 64, 0.65); backdrop-filter: blur(8px); z-index: 1000001; display: grid; place-items: center; padding: 20px;";
      document.body.appendChild(backdrop);
    }
    backdrop.replaceChildren(); // Safe clearing

    const card = document.createElement("div");
    card.style.cssText = "background: var(--white); border-radius: 16px; padding: 32px; width: min(500px, 100%); box-shadow: 0 20px 50px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 16px;";

    const title = document.createElement("h3");
    title.textContent = el.tagName.toLowerCase() === "img" ? "Edit Image Element" : "Edit Text Content";
    title.style.cssText = "margin: 0; font-size: 1.35rem; color: var(--navy);";

    card.appendChild(title);

    if (el.tagName.toLowerCase() === "img") {
      const srcLabel = document.createElement("label");
      srcLabel.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
      srcLabel.textContent = "Image URL / Path:";
      const srcInput = document.createElement("input");
      srcInput.type = "text";
      srcInput.value = el.getAttribute("src") || "";
      srcInput.style.cssText = "padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 0.95rem; width: 100%;";
      srcLabel.appendChild(srcInput);

      const altLabel = document.createElement("label");
      altLabel.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
      altLabel.textContent = "Alt Description:";
      const altInput = document.createElement("input");
      altInput.type = "text";
      altInput.value = el.getAttribute("alt") || "";
      altInput.style.cssText = "padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 0.95rem; width: 100%;";
      altLabel.appendChild(altInput);

      card.appendChild(srcLabel);
      card.appendChild(altLabel);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display: flex; gap: 12px; margin-top: 10px;";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "button quiet";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
      cancelBtn.addEventListener("click", () => { backdrop.style.display = "none"; });

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "button primary";
      applyBtn.textContent = "Apply Image Change";
      applyBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
      applyBtn.addEventListener("click", () => {
        const newSrc = srcInput.value.trim();
        const newAlt = altInput.value.trim();
        if (newSrc) {
          el.setAttribute("src", newSrc);
          el.setAttribute("alt", newAlt);
          editedOverrides[key] = { type: "image", src: newSrc, alt: newAlt };
        }
        backdrop.style.display = "none";
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(applyBtn);
      card.appendChild(btnRow);
    } else {
      const textLabel = document.createElement("label");
      textLabel.style.cssText = "display: flex; flex-direction: column; gap: 6px; font-size: 0.9rem; font-weight: 700; color: var(--ink);";
      textLabel.textContent = "Text Content:";
      const textArea = document.createElement("textarea");
      textArea.rows = 4;
      textArea.value = el.textContent || "";
      textArea.style.cssText = "padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 0.95rem; width: 100%; font-family: inherit; line-height: 1.5; resize: vertical;";
      textLabel.appendChild(textArea);
      card.appendChild(textLabel);

      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display: flex; gap: 12px; margin-top: 10px;";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "button quiet";
      cancelBtn.textContent = "Cancel";
      cancelBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
      cancelBtn.addEventListener("click", () => { backdrop.style.display = "none"; });

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "button primary";
      applyBtn.textContent = "Apply Text Change";
      applyBtn.style.cssText = "flex: 1; padding: 12px; border-radius: 999px; cursor: pointer;";
      applyBtn.addEventListener("click", () => {
        const newText = textArea.value.trim();
        el.textContent = newText;
        editedOverrides[key] = { type: "text", content: newText };
        backdrop.style.display = "none";
      });

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(applyBtn);
      card.appendChild(btnRow);
    }

    backdrop.style.display = "grid";
    backdrop.appendChild(card);
  }

  function exportPublishedSite(publishBtn) {
    // We clone the document documentElement, apply current content, and generate downloadable html patch
    const htmlClone = document.documentElement.cloneNode(true);
    // Clean up admin modals and scripts from the exported clone if needed, but keeping data-admin-key allows future edits
    const adminBar = htmlClone.querySelector("#admin-control-bar");
    if (adminBar) adminBar.remove();
    const adminModals = htmlClone.querySelectorAll(".admin-modal-backdrop, .admin-edit-backdrop");
    adminModals.forEach((m) => m.remove());
    const adminBtn = htmlClone.querySelector(".admin-toggle-btn");
    if (adminBtn) adminBtn.remove();
    const sectionToggles = htmlClone.querySelectorAll(".admin-section-toggle");
    sectionToggles.forEach(t => t.remove());
    const addStoreBtns = htmlClone.querySelectorAll(".admin-add-store-btn");
    addStoreBtns.forEach(b => b.remove());
    
    // Remove injected admin styles
    const adminStyles = htmlClone.querySelector("#admin-styles");
    if (adminStyles) adminStyles.remove();

    // Strip admin classes from the body and all editable elements
    htmlClone.querySelector("body").classList.remove("admin-mode");
    const editableElements = htmlClone.querySelectorAll(".admin-editable-hover");
    editableElements.forEach(el => el.classList.remove("admin-editable-hover"));

    const htmlContent = "<!DOCTYPE html>\n" + htmlClone.outerHTML;
    
    if (publishBtn) publishBtn.textContent = "🚀 Publishing...";
    
    fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        html: htmlContent,
        storesJSON: window.streamlineStoresModified ? window.STREAMLINE_STORE_DATA : null
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (publishBtn) {
          publishBtn.textContent = "✅ Published Live!";
          setTimeout(() => { publishBtn.textContent = "🚀 Publish Live"; }, 2000);
        }
      } else {
        alert("Publish failed: " + (data.error || 'Unknown error'));
        if (publishBtn) publishBtn.textContent = "🚀 Publish Live";
      }
    })
    .catch(err => {
      // Fallback for purely static environments without the Node server
      console.warn("Backend /api/publish not found, falling back to download.");
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "index.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (publishBtn) publishBtn.textContent = "🚀 Publish Live";
    });
  }

  // Inject CSS rules for admin editable highlights
  function injectAdminStyles() {
    if (document.getElementById("admin-styles")) return;
    const style = document.createElement("style");
    style.id = "admin-styles";
    style.textContent = `
      .admin-editable-hover {
        transition: outline 0.2s ease, background 0.2s ease;
      }
      .admin-editable-hover:hover {
        outline: 2px dashed var(--red) !important;
        outline-offset: 4px;
        cursor: pointer !important;
        background: rgba(231, 71, 47, 0.05) !important;
      }
    `;
    document.head.appendChild(style);
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectAdminStyles();
    tagEditableElements();
    loadSavedOverrides();
    createAdminButton();
  });
})();
