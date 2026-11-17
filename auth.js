// 사용자 정보는 localStorage의 "users" 키에 { 아이디: 비밀번호 } 형태로 저장
// (학습용 예제이므로 비밀번호를 평문으로 저장함 — 실제 서비스에서는 서버에서 해시 처리해야 함)

// 이미 로그인되어 있으면 바로 투두 화면으로 이동
if (localStorage.getItem("currentUser")) {
  location.href = "todo.html";
}

let isSignup = false; // false: 로그인 모드, true: 회원가입 모드

const form = document.getElementById("authForm");
const userIdInput = document.getElementById("userId");
const pwInput = document.getElementById("password");
const pwConfirmInput = document.getElementById("passwordConfirm");
const confirmWrap = document.getElementById("confirmWrap");
const title = document.getElementById("title");
const subtitle = document.getElementById("subtitle");
const submitBtn = document.getElementById("submitBtn");
const switchText = document.getElementById("switchText");
const switchLink = document.getElementById("switchLink");
const msg = document.getElementById("msg");

function getUsers() {
  return JSON.parse(localStorage.getItem("users") || "{}");
}

function saveUsers(users) {
  localStorage.setItem("users", JSON.stringify(users));
}

function showMsg(text, ok = false) {
  msg.textContent = text;
  msg.className = ok ? "msg ok" : "msg";
}

// 로그인 <-> 회원가입 모드 전환
function setMode(signup) {
  isSignup = signup;
  title.textContent = signup ? "회원가입" : "로그인";
  subtitle.textContent = signup ? "새 계정을 만들어 주세요." : "투두리스트를 사용하려면 로그인하세요.";
  submitBtn.textContent = signup ? "회원가입" : "로그인";
  switchText.textContent = signup ? "이미 계정이 있으신가요?" : "계정이 없으신가요?";
  switchLink.textContent = signup ? "로그인" : "회원가입";
  confirmWrap.style.display = signup ? "block" : "none";
  pwConfirmInput.value = "";
  showMsg("");
}

switchLink.addEventListener("click", () => setMode(!isSignup));

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const id = userIdInput.value.trim();
  const pw = pwInput.value;
  const users = getUsers();

  if (!id || !pw) {
    showMsg("아이디와 비밀번호를 입력하세요.");
    return;
  }

  if (isSignup) {
    if (id.length < 3) return showMsg("아이디는 3자 이상이어야 합니다.");
    if (pw.length < 4) return showMsg("비밀번호는 4자 이상이어야 합니다.");
    if (pw !== pwConfirmInput.value) return showMsg("비밀번호가 일치하지 않습니다.");
    if (users[id]) return showMsg("이미 존재하는 아이디입니다.");

    users[id] = pw;
    saveUsers(users);
    setMode(false);
    pwInput.value = "";
    showMsg("회원가입 완료! 로그인해 주세요.", true);
    return;
  }

  // 로그인
  if (!users[id] || users[id] !== pw) {
    showMsg("아이디 또는 비밀번호가 올바르지 않습니다.");
    return;
  }

  localStorage.setItem("currentUser", id);
  location.href = "todo.html";
});
