const revealItems = document.querySelectorAll(".reveal");
const copyEmailButton = document.querySelector(".copy-email");
const copyStatus = document.querySelector(".copy-status");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    const target = document.querySelector(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

if (copyEmailButton && copyStatus) {
  copyEmailButton.addEventListener("click", async (event) => {
    const email = copyEmailButton.dataset.email;

    if (!navigator.clipboard || !email) {
      return;
    }

    event.preventDefault();

    try {
      await navigator.clipboard.writeText(email);
      copyStatus.textContent = "邮箱已复制，可以直接粘贴发送。";
    } catch {
      copyStatus.textContent = "复制失败时，也可以直接点击邮箱打开邮件客户端。";
      window.location.href = `mailto:${email}`;
    }

    window.setTimeout(() => {
      copyStatus.textContent = "";
    }, 3200);
  });
}
