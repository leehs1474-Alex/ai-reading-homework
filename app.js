"use strict";

const API_URL =
  "https://script.google.com/macros/s/AKfycbykgxy9mGqvOZ686S_dcikojosLiw5_3BJ6z92YfSXt_wGRsSmrb0Odv7YEC8eEJ3E/exec";

const classSelect = document.getElementById("classSelect");
const studentSelect = document.getElementById("studentSelect");
const startButton = document.getElementById("startButton");
const statusMessage = document.getElementById("statusMessage");

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  bindEvents();
  await loadClasses();
}

function bindEvents() {
  classSelect.addEventListener("change", handleClassChange);
  studentSelect.addEventListener("change", handleStudentChange);
  startButton.addEventListener("click", handleStartClick);
}

async function loadClasses() {
  setLoadingState(true);

  try {
    const data = await requestApi("getClasses");

    if (!data.success) {
      throw new Error(data.message || "반 정보를 불러오지 못했습니다.");
    }

    renderClassOptions(data.classes || []);

    classSelect.disabled = false;

    showStatus(
      "반을 선택해주세요.",
      ""
    );
  } catch (error) {
    console.error(error);

    classSelect.innerHTML =
      '<option value="">반 정보를 불러오지 못했습니다</option>';

    showStatus(
      "반 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
      "error"
    );
  } finally {
    setLoadingState(false);
  }
}

async function handleClassChange() {
  const className = classSelect.value;

  resetStudentSelect();
  startButton.disabled = true;

  if (!className) {
    showStatus("반을 선택해주세요.", "");
    return;
  }

  studentSelect.innerHTML =
    '<option value="">학생 정보를 불러오는 중...</option>';

  studentSelect.disabled = true;

  showStatus("학생 정보를 불러오고 있습니다.", "");

  try {
    const data = await requestApi(
      "getStudents",
      {
        className: className
      }
    );

    if (!data.success) {
      throw new Error(data.message || "학생 정보를 불러오지 못했습니다.");
    }

    renderStudentOptions(data.students || []);

    studentSelect.disabled = false;

    if (!data.students || data.students.length === 0) {
      showStatus(
        "이 반에 등록된 학생이 없습니다.",
        "error"
      );

      return;
    }

    showStatus(
      "이름을 선택해주세요.",
      ""
    );
  } catch (error) {
    console.error(error);

    studentSelect.innerHTML =
      '<option value="">학생 정보를 불러오지 못했습니다</option>';

    showStatus(
      "학생 정보를 불러오지 못했습니다.",
      "error"
    );
  }
}

function handleStudentChange() {
  startButton.disabled = !studentSelect.value;

  if (studentSelect.value) {
    showStatus(
      "숙제 시작 버튼을 눌러주세요.",
      "success"
    );
  } else {
    showStatus(
      "이름을 선택해주세요.",
      ""
    );
  }
}

async function handleStartClick() {
  const selectedOption =
    studentSelect.options[studentSelect.selectedIndex];

  const studentId = studentSelect.value;
  const studentName = selectedOption?.textContent || "";
  const className = classSelect.value;

  if (!className || !studentId) {
    showStatus(
      "반과 이름을 모두 선택해주세요.",
      "error"
    );

    return;
  }

  startButton.disabled = true;
  startButton.textContent = "숙제를 불러오는 중...";

  showStatus(
    `${studentName} 학생의 숙제를 확인하고 있습니다.`,
    ""
  );

  try {
    const data = await requestApi(
      "getCurrentHomework",
      {
        studentId: studentId,
        className: className
      }
    );

    if (!data.success) {
      throw new Error(
        data.message || "숙제를 불러오지 못했습니다."
      );
    }

    if (!data.hasHomework || !data.homework) {
      showStatus(
        "현재 해야 할 숙제가 없습니다.",
        "success"
      );

      return;
    }

    showHomeworkScreen(data.homework);

  } catch (error) {
    console.error(error);

    showStatus(
      "숙제를 불러오지 못했습니다. 다시 시도해주세요.",
      "error"
    );
  } finally {
    startButton.disabled = false;
    startButton.textContent = "숙제 시작";
  }
}

async function requestApi(action, parameters = {}) {
  const url = new URL(API_URL);

  url.searchParams.set("action", action);

  Object.entries(parameters).forEach(function([key, value]) {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    redirect: "follow",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `API 요청 실패: ${response.status}`
    );
  }

  return response.json();
}

function renderClassOptions(classes) {
  classSelect.innerHTML =
    '<option value="">반을 선택하세요</option>';

  classes.forEach(function(className) {
    const option = document.createElement("option");

    option.value = className;
    option.textContent = className;

    classSelect.appendChild(option);
  });
}

function renderStudentOptions(students) {
  studentSelect.innerHTML =
    '<option value="">이름을 선택하세요</option>';

  students.forEach(function(student) {
    const option = document.createElement("option");

    option.value = student.studentId;
    option.textContent = student.studentName;

    studentSelect.appendChild(option);
  });
}

function resetStudentSelect() {
  studentSelect.innerHTML =
    '<option value="">먼저 반을 선택하세요</option>';

  studentSelect.disabled = true;
}

function setLoadingState(isLoading) {
  if (isLoading) {
    classSelect.disabled = true;
    studentSelect.disabled = true;
    startButton.disabled = true;
  }
}

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (type) {
    statusMessage.classList.add(type);
  }
}
function showHomeworkScreen(homework) {
  const loginScreen =
    document.getElementById("loginScreen");

  const homeworkScreen =
    document.getElementById("homeworkScreen");

  const homeworkTitle =
    document.getElementById("homeworkTitle");

  const bookTitle =
    document.getElementById("bookTitle");

  const sentenceProgress =
    document.getElementById("sentenceProgress");

  const sentenceText =
    document.getElementById("sentenceText");

  const homeworkStatus =
    document.getElementById("homeworkStatus");

  const firstSentence =
    homework.sentences?.[0];

  if (!firstSentence) {
    showStatus(
      "숙제 문장을 찾을 수 없습니다.",
      "error"
    );

    return;
  }

  homeworkTitle.textContent =
    homework.homeworkTitle || "Reading 숙제";

  bookTitle.textContent =
    homework.bookTitle || "";

  sentenceProgress.textContent =
    `문장 1 / ${homework.sentenceCount}`;

  sentenceText.textContent =
    firstSentence.sentenceText;

  homeworkStatus.textContent =
    "문장을 소리 내어 읽어보세요.";

  loginScreen.classList.add("hidden");
  homeworkScreen.classList.remove("hidden");
}
