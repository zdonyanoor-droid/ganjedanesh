"use strict";

/* =========================================================
   بازی گنج دانش - app.js
   منطق کامل بازی: مدیریت حالت، بارگذاری سؤال از JSON،
   نمایش سؤال به ترتیب (بدون تصادفی‌سازی)، ذخیره امتیاز در LocalStorage
   ========================================================= */

(function () {
  const STORAGE_KEY = "ganjeDaneshState_v1";

  /* تنظیمات هر بخش بازی */
  const SECTIONS = {
    farsi: {
      key: "farsi",
      title: "حافظیه",
      jsonUrl: "data/question1.json",
      bgClass: "bg-farsi",
      hubBgClass: "hub-bg-farsi",
      rewardImg: "images/emtiaz.png",
      rewardEmoji: "⭐",
      rewardLabel: "امتیاز",
      scoreField: "farsiScore",
      totalQuestions: 40,
      nextSection: "math"
    },
    math: {
      key: "math",
      title: "سفینه ریاضی",
      jsonUrl: "data/question2.json",
      bgClass: "bg-math",
      hubBgClass: "hub-bg-math",
      rewardImg: "images/medal.png",
      rewardEmoji: "🏅",
      rewardLabel: "مدال",
      scoreField: "mathScore",
      totalQuestions: 40,
      nextSection: "science"
    },
    science: {
      key: "science",
      title: "آزمایشگاه علوم",
      jsonUrl: "data/question3.json",
      bgClass: "bg-science",
      hubBgClass: "hub-bg-science",
      rewardImg: "images/coin.png",
      rewardEmoji: "🪙",
      rewardLabel: "سکه",
      scoreField: "scienceScore",
      totalQuestions: 40,
      nextSection: "treasure"
    }
  };

  const SECTION_ORDER = ["farsi", "math", "science", "treasure"];

  /* ------------------- مدیریت حالت (State) ------------------- */
  function defaultState() {
    return {
      playerName: "",
      farsiScore: 0,
      mathScore: 0,
      scienceScore: 0,
      progress: {
        farsi: { index: 0, completed: false },
        math: { index: 0, completed: false },
        science: { index: 0, completed: false }
      },
      treasureOpened: false
    };
  }

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return Object.assign(base, parsed, {
        progress: Object.assign(base.progress, parsed.progress || {})
      });
    } catch (e) {
      console.warn("خطا در خواندن اطلاعات ذخیره‌شده:", e);
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("امکان ذخیره اطلاعات وجود ندارد (LocalStorage):", e);
    }
  }

  /* ------------------- ابزارهای کمکی امنیتی/متنی ------------------- */
  function sanitizeName(raw) {
    if (typeof raw !== "string") return "";
    let name = raw.replace(/<[^>]*>/g, ""); // حذف هرگونه تگ احتمالی
    name = name.trim().slice(0, 24);
    return name;
  }

  function escapeHtmlText(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ------------------- ارجاع به عناصر DOM ------------------- */
  const el = {
    screens: {
      start: document.getElementById("screen-start"),
      hub: document.getElementById("screen-hub"),
      quiz: document.getElementById("screen-quiz"),
      complete: document.getElementById("screen-complete"),
      treasure: document.getElementById("screen-treasure"),
      error: document.getElementById("screen-error")
    },
    startForm: document.getElementById("start-form"),
    nameInput: document.getElementById("player-name-input"),
    startError: document.getElementById("start-error"),
    headerBadges: document.querySelectorAll(".score-badges"),
    starCount: document.querySelectorAll(".js-star-count"),
    medalCount: document.querySelectorAll(".js-medal-count"),
    coinCount: document.querySelectorAll(".js-coin-count"),
    resetButtons: document.querySelectorAll(".reset-btn"),
    hubGreeting: document.getElementById("hub-greeting"),
    hubCards: {
      farsi: document.getElementById("card-farsi"),
      math: document.getElementById("card-math"),
      science: document.getElementById("card-science"),
      treasure: document.getElementById("card-treasure")
    },
    quizBg: document.getElementById("quiz-bg"),
    quizSectionTitle: document.getElementById("quiz-section-title"),
    quizProgressText: document.getElementById("quiz-progress-text"),
    quizProgressFill: document.getElementById("quiz-progress-fill"),
    questionText: document.getElementById("question-text"),
    optionsList: document.getElementById("options-list"),
    feedbackPanel: document.getElementById("feedback-panel"),
    feedbackTitle: document.getElementById("feedback-title"),
    feedbackExplanation: document.getElementById("feedback-explanation"),
    ackBtn: document.getElementById("ack-btn"),
    quizBackBtn: document.getElementById("quiz-back-btn"),
    rewardPop: document.getElementById("reward-pop"),
    rewardPopImg: document.getElementById("reward-pop-img"),
    rewardPopText: document.getElementById("reward-pop-text"),
    completeEmoji: document.getElementById("complete-emoji"),
    completeTitle: document.getElementById("complete-title"),
    completeText: document.getElementById("complete-text"),
    completeNextBtn: document.getElementById("complete-next-btn"),
    chestBtn: document.getElementById("chest-btn"),
    chestImg: document.getElementById("chest-img"),
    scrollWrap: document.getElementById("scroll-wrap"),
    scrollHeroName: document.getElementById("scroll-hero-name"),
    scrollFarsi: document.getElementById("scroll-farsi"),
    scrollMath: document.getElementById("scroll-math"),
    scrollScience: document.getElementById("scroll-science"),
    scrollTotal: document.getElementById("scroll-total"),
    errorMessage: document.getElementById("error-message"),
    errorRetryBtn: document.getElementById("error-retry-btn"),
    errorHomeBtn: document.getElementById("error-home-btn")
  };

  let currentRetry = null;
  let currentSectionKey = null;
  let currentQuestions = [];
  let currentImgHandler = null;

  /* ------------------- سوییچ بین صفحات ------------------- */
  function showScreen(name) {
    Object.values(el.screens).forEach((s) => s && s.classList.remove("active"));
    if (el.screens[name]) {
      el.screens[name].classList.add("active");
      el.screens[name].focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
  }

  /* ------------------- fallback برای تصاویر ناموجود ------------------- */
  function attachImgFallback(imgEl, emojiText) {
    if (!imgEl) return;
    imgEl.addEventListener(
      "error",
      function onErr() {
        const span = document.createElement("span");
        span.className = "emoji-fallback";
        span.textContent = emojiText;
        span.style.fontSize = imgEl.dataset.fallbackSize || "1.4rem";
        span.setAttribute("role", "img");
        span.setAttribute("aria-label", imgEl.alt || "");
        if (imgEl.parentNode) {
          imgEl.parentNode.replaceChild(span, imgEl);
        }
      },
      { once: true }
    );
  }

  function setupAllImageFallbacks() {
    document.querySelectorAll("img[data-emoji-fallback]").forEach((img) => {
      attachImgFallback(img, img.dataset.emojiFallback);
    });
  }

  /* ------------------- به‌روزرسانی نشان‌های امتیاز در هدر ------------------- */
  function updateScoreBadges() {
    document.querySelectorAll(".js-star-count").forEach((n) => (n.textContent = state.farsiScore));
    document.querySelectorAll(".js-medal-count").forEach((n) => (n.textContent = state.mathScore));
    document.querySelectorAll(".js-coin-count").forEach((n) => (n.textContent = state.scienceScore));
    document.querySelectorAll(".js-total-count").forEach(
      (n) => (n.textContent = state.farsiScore + state.mathScore + state.scienceScore)
    );
  }

  /* ------------------- صفحه شروع ------------------- */
  function initStartScreen() {
    if (state.playerName) {
      el.nameInput.value = state.playerName;
    }
    el.startForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = sanitizeName(el.nameInput.value);
      if (!name) {
        el.startError.textContent = "لطفاً نام خود را بنویس تا سفر آغاز شود!";
        el.nameInput.focus();
        return;
      }
      el.startError.textContent = "";
      state.playerName = name;
      saveState();
      goToHub();
    });
  }

  /* ------------------- هاب (نقشه گنج) ------------------- */
  function goToHub() {
    updateScoreBadges();
    el.hubGreeting.textContent = `درود بر تو، قهرمان سرزمین پارس «${state.playerName}»! مسیر رسیدن به گنج دانش را ادامه بده.`;
    renderHubLocks();
    showScreen("hub");
  }

  function isSectionUnlocked(key) {
    if (key === "farsi") return true;
    if (key === "math") return state.progress.farsi.completed;
    if (key === "science") return state.progress.math.completed;
    if (key === "treasure") return state.progress.science.completed;
    return false;
  }

  function renderHubLocks() {
    Object.keys(el.hubCards).forEach((key) => {
      const card = el.hubCards[key];
      if (!card) return;
      const unlocked = isSectionUnlocked(key);
      card.disabled = !unlocked;
      const lockBadge = card.querySelector(".lock-badge");
      const doneBadge = card.querySelector(".done-badge");
      if (lockBadge) lockBadge.style.display = unlocked ? "none" : "flex";
      const completed = key === "treasure" ? state.treasureOpened : state.progress[key] && state.progress[key].completed;
      if (doneBadge) doneBadge.style.display = completed ? "flex" : "none";
    });
  }

  function bindHubCards() {
    el.hubCards.farsi.addEventListener("click", () => tryEnterSection("farsi"));
    el.hubCards.math.addEventListener("click", () => tryEnterSection("math"));
    el.hubCards.science.addEventListener("click", () => tryEnterSection("science"));
    el.hubCards.treasure.addEventListener("click", () => {
      if (!isSectionUnlocked("treasure")) return;
      openTreasureScreen();
    });
  }

  function tryEnterSection(key) {
    if (!isSectionUnlocked(key)) return;
    loadSectionQuestions(key);
  }

  /* ------------------- بارگذاری سؤال‌ها از فایل JSON ------------------- */
  function loadSectionQuestions(key) {
    const cfg = SECTIONS[key];
    currentRetry = () => loadSectionQuestions(key);

    fetch(cfg.jsonUrl, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error("network-error");
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error("invalid-json");
        }
        /* اطمینان از ترتیب صعودی بر اساس id (نمایش به ترتیب، بدون تصادفی‌سازی) */
        const sorted = data.questions.slice().sort((a, b) => a.id - b.id);
        currentQuestions = sorted;
        startQuiz(key);
      })
      .catch((err) => {
        console.error(err);
        showErrorScreen(
          `متأسفانه در بارگذاری سؤال‌های بخش «${cfg.title}» خطایی رخ داد. لطفاً از وجود فایل ${cfg.jsonUrl} در پوشه data اطمینان حاصل کن و دوباره تلاش کن.`
        );
      });
  }

  function showErrorScreen(message) {
    el.errorMessage.textContent = message;
    showScreen("error");
  }

  /* ------------------- موتور آزمون ------------------- */
  function startQuiz(key) {
    currentSectionKey = key;
    const cfg = SECTIONS[key];
    if (!state.progress[key]) {
      state.progress[key] = { index: 0, completed: false };
    }
    if (state.progress[key].index >= currentQuestions.length) {
      state.progress[key].index = 0;
    }
    el.quizBg.className = "quiz-bg " + cfg.bgClass;
    el.quizSectionTitle.textContent = cfg.title;
    updateScoreBadges();
    showScreen("quiz");
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    const key = currentSectionKey;
    const cfg = SECTIONS[key];
    const idx = state.progress[key].index;
    const total = currentQuestions.length;

    if (idx >= total) {
      finishSection(key);
      return;
    }

    const q = currentQuestions[idx];
    el.feedbackPanel.hidden = true;
    el.feedbackPanel.className = "feedback-panel";
    el.optionsList.innerHTML = "";

    el.quizProgressText.textContent = `سؤال ${idx + 1} از ${total}`;
    el.quizProgressFill.style.width = Math.round(((idx) / total) * 100) + "%";

    el.questionText.textContent = q.question || "";

    const letters = ["الف", "ب", "ج", "د"];
    (q.options || []).forEach((optText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.setAttribute("data-index", i);
      const letterSpan = document.createElement("span");
      letterSpan.className = "opt-letter";
      letterSpan.textContent = letters[i] || i + 1;
      const textSpan = document.createElement("span");
      textSpan.textContent = optText;
      btn.appendChild(letterSpan);
      btn.appendChild(textSpan);
      btn.addEventListener("click", () => handleAnswer(i, btn));
      el.optionsList.appendChild(btn);
    });

    el.optionsList.setAttribute("aria-busy", "false");
  }

  function handleAnswer(selectedIndex, btnEl) {
    const key = currentSectionKey;
    const cfg = SECTIONS[key];
    const idx = state.progress[key].index;
    const q = currentQuestions[idx];
    const correctIndex = q.answer;
    const isCorrect = selectedIndex === correctIndex;

    const allBtns = el.optionsList.querySelectorAll(".option-btn");
    allBtns.forEach((b) => (b.disabled = true));

    if (isCorrect) {
      btnEl.classList.add("correct");
    } else {
      btnEl.classList.add("wrong");
      const correctBtn = el.optionsList.querySelector(`[data-index="${correctIndex}"]`);
      if (correctBtn) correctBtn.classList.add("correct");
    }

    if (isCorrect) {
      state[cfg.scoreField] += 1;
      saveState();
      updateScoreBadges();
      showRewardPop(cfg);
    }

    el.feedbackPanel.hidden = false;
    el.feedbackPanel.classList.add(isCorrect ? "correct" : "wrong");
    el.feedbackTitle.textContent = isCorrect ? "آفرین! پاسخ درست بود 🎉" : "پاسخ درست این بود:";
    const correctText = (q.options && q.options[correctIndex]) || "";
    el.feedbackExplanation.innerHTML = "";

    if (!isCorrect) {
      const p1 = document.createElement("p");
      p1.innerHTML = `<strong>${escapeHtmlText(correctText)}</strong>`;
      el.feedbackExplanation.appendChild(p1);
    }
    const p2 = document.createElement("p");
    p2.textContent = q.explanation || "";
    el.feedbackExplanation.appendChild(p2);

    el.feedbackPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.ackBtn.focus();
  }

  function showRewardPop(cfg) {
    el.rewardPop.classList.remove("show");
    void el.rewardPop.offsetWidth; // ری‌استارت انیمیشن
    el.rewardPopImg.src = cfg.rewardImg;
    el.rewardPopImg.alt = cfg.rewardLabel;
    el.rewardPopImg.style.display = "";
    if (currentImgHandler) {
      el.rewardPopImg.removeEventListener("error", currentImgHandler);
    }
    currentImgHandler = function () {
      el.rewardPopImg.style.display = "none";
    };
    el.rewardPopImg.addEventListener("error", currentImgHandler, { once: true });
    el.rewardPopText.textContent = `${cfg.rewardEmoji} +۱ ${cfg.rewardLabel}`;
    el.rewardPop.classList.add("show");
  }

  el.ackBtn.addEventListener("click", () => {
    const key = currentSectionKey;
    state.progress[key].index += 1;
    saveState();
    renderCurrentQuestion();
  });

  el.quizBackBtn.addEventListener("click", () => {
    goToHub();
  });

  function finishSection(key) {
    const cfg = SECTIONS[key];
    state.progress[key].completed = true;
    saveState();
    renderHubLocks();

    el.completeEmoji.textContent = key === "farsi" ? "📖✨" : key === "math" ? "🚀✨" : "🧪✨";
    el.completeTitle.textContent = `آفرین ${escapeText(state.playerName)}! بخش «${cfg.title}» را با موفقیت به پایان رساندی.`;
    const scoreVal = state[cfg.scoreField];
    el.completeText.textContent = `تو در این بخش ${scoreVal} ${cfg.rewardLabel} گرفتی. ${
      cfg.nextSection === "treasure"
        ? "حالا وقت آن رسیده که صندوقچه گنج دانش را باز کنی!"
        : "حالا بخش بعدی برایت باز شد."
    }`;
    el.completeNextBtn.textContent =
      cfg.nextSection === "treasure" ? "برو به صندوقچه گنج 🏆" : `ورود به ${SECTIONS[cfg.nextSection].title}`;
    el.completeNextBtn.onclick = () => {
      goToHub();
    };
    showScreen("complete");
  }

  function escapeText(t) {
    return (t || "").toString();
  }

  /* ------------------- صندوقچه گنج ------------------- */
  function openTreasureScreen() {
    showScreen("treasure");
    el.chestBtn.classList.remove("opened");
    el.scrollWrap.classList.remove("show");
    el.chestBtn.disabled = false;
    el.chestBtn.setAttribute("aria-expanded", "false");
  }

  el.chestBtn.addEventListener("click", () => {
    el.chestBtn.classList.add("opened");
    el.chestBtn.disabled = true;
    el.chestBtn.setAttribute("aria-expanded", "true");
    state.treasureOpened = true;
    saveState();
    renderHubLocks();

    setTimeout(() => {
      const total = state.farsiScore + state.mathScore + state.scienceScore;
      el.scrollHeroName.textContent = state.playerName;
      el.scrollFarsi.textContent = state.farsiScore;
      el.scrollMath.textContent = state.mathScore;
      el.scrollScience.textContent = state.scienceScore;
      el.scrollTotal.textContent = total;
      el.scrollWrap.classList.add("show");
      el.scrollWrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 500);
  });

  /* ------------------- خطا: تلاش دوباره / بازگشت ------------------- */
  el.errorRetryBtn.addEventListener("click", () => {
    if (typeof currentRetry === "function") currentRetry();
  });
  el.errorHomeBtn.addEventListener("click", () => {
    goToHub();
  });

  /* ------------------- بازنشانی کامل بازی ------------------- */
  function bindResetButtons() {
    el.resetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const ok = confirm("آیا مطمئنی می‌خواهی بازی را از نو شروع کنی؟ همه امتیازها پاک می‌شود.");
        if (!ok) return;
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        location.reload();
      });
    });
  }

  /* ------------------- ثبت Service Worker ------------------- */
  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch((err) => {
          console.warn("ثبت Service Worker ناموفق بود:", err);
        });
      });
    }
  }

  /* ------------------- شروع برنامه ------------------- */
  function init() {
    setupAllImageFallbacks();
    initStartScreen();
    bindHubCards();
    bindResetButtons();
    registerServiceWorker();

    if (state.playerName) {
      goToHub();
    } else {
      showScreen("start");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
