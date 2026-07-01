// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Will store our timer that creates drops regularly
let timerTick; // Stores countdown interval
let challengeTimer;
let challengeEndTimer;
let obstacleMaker;
let score = 0;
let timeLeft = 30;
let challengeActive = false;
let celebrationTimeout;

const TARGET_SCORE = 20;

const winningMessages = [
  "Amazing work! You helped protect clean water.",
  "You win! Great job catching those clean drops.",
  "Water hero! You reached the clean water goal.",
  "Fantastic! You beat the challenge and kept water clean."
];

const losingMessages = [
  "Try again! Keep focusing on clean drops.",
  "Almost there. Try again and avoid dirty drops.",
  "Good effort! Try again to reach 20 points.",
  "Keep going! You can hit the clean water goal next round."
];

const startButton = document.getElementById("start-btn");
const resetButton = document.getElementById("reset-btn");
const gameContainer = document.getElementById("game-container");
const scoreDisplay = document.getElementById("score");
const timeDisplay = document.getElementById("time");
const challengeStatusDisplay = document.getElementById("challenge-status");
const feedbackDisplay = document.getElementById("feedback-message");
const feedbackText = feedbackDisplay.querySelector("span");
const celebrationOverlay = document.getElementById("celebration-overlay");

// Wait for button click to start the game
startButton.addEventListener("click", startGame);
resetButton.addEventListener("click", resetGame);

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  gameRunning = true;
  score = 0;
  timeLeft = 30;
  updateScore();
  updateTime();
  updateChallengeStatus("Calm", false);
  clearTimeout(celebrationTimeout);
  clearCelebration();
  gameContainer.innerHTML = "";
  startButton.textContent = "Playing...";
  setFeedback("Collect clean drops (+2). Avoid dirty drops (-3).", "good");

  // Create new drops every second (1000 milliseconds)
  dropMaker = setInterval(createDrop, 700);
  timerTick = setInterval(updateGameTimer, 1000);
  scheduleChallenge();
}

function createDrop() {
  if (!gameRunning) return;

  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop";

  const badDropChance = challengeActive ? 0.45 : 0.2;
  const isBadDrop = Math.random() < badDropChance;
  if (isBadDrop) {
    drop.classList.add("bad-drop");
  }

  // Make drops different sizes for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;

  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * (gameWidth - size);
  drop.style.left = xPosition + "px";

  // Make drops fall slower for easier tracking and tapping
  drop.style.animationDuration = `${Math.random() * 2 + 4.5}s`;
  drop.style.setProperty("--drop-fall-distance", `${gameContainer.clientHeight + 30}px`);
  let dropHandled = false;

  drop.addEventListener("click", () => {
    if (!gameRunning || dropHandled) return;

    dropHandled = true;
    if (isBadDrop) {
      const dirtyPenalty = challengeActive ? 5 : 3;
      score -= dirtyPenalty;
      setFeedback(`Dirty drop! -${dirtyPenalty} points`, "bad");
    } else {
      score += 2;
      setFeedback("Great catch! +2 points", "good");
    }
    updateScore();
    drop.remove();
  });

  // Add the new drop to the game screen
  gameContainer.appendChild(drop);

  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    if (!dropHandled && gameRunning && !isBadDrop) {
      const missPenalty = challengeActive ? 2 : 1;
      score -= missPenalty;
      updateScore();
      setFeedback(`Missed clean drop! -${missPenalty} point${missPenalty > 1 ? "s" : ""}`, "bad");
    }

    dropHandled = true;
    drop.remove(); // Clean up drops that weren't caught
  });
}

function createObstacle() {
  if (!gameRunning || !challengeActive) return;

  const obstacle = document.createElement("div");
  obstacle.className = "trash-obstacle";

  const gameWidth = gameContainer.offsetWidth;
  const obstacleSize = 56;
  const xPosition = Math.random() * (gameWidth - obstacleSize);
  obstacle.style.left = xPosition + "px";
  obstacle.style.animationDuration = `${Math.random() * 1.4 + 2.2}s`;
  obstacle.style.setProperty("--obstacle-fall-distance", `${gameContainer.clientHeight + 40}px`);

  obstacle.addEventListener("click", () => {
    if (!gameRunning || !challengeActive) return;

    score -= 4;
    updateScore();
    setFeedback("Hit trash obstacle! -4 points", "bad");
    obstacle.remove();
  });

  obstacle.addEventListener("animationend", () => {
    obstacle.remove();
  });

  gameContainer.appendChild(obstacle);
}

function scheduleChallenge() {
  if (!gameRunning) return;

  const nextChallengeDelay = Math.random() * 3000 + 5000;
  challengeTimer = setTimeout(activateChallenge, nextChallengeDelay);
}

function activateChallenge() {
  if (!gameRunning) return;

  challengeActive = true;
  updateChallengeStatus("Pollution Surge", true);
  gameContainer.classList.add("challenge-active");
  setFeedback("Pollution surge! More bad drops and trash obstacles.", "bad");

  obstacleMaker = setInterval(createObstacle, 900);
  challengeEndTimer = setTimeout(deactivateChallenge, 4500);
}

function deactivateChallenge() {
  challengeActive = false;
  updateChallengeStatus("Calm", false);
  gameContainer.classList.remove("challenge-active");
  clearInterval(obstacleMaker);
  gameContainer.querySelectorAll(".trash-obstacle").forEach((obstacle) => obstacle.remove());

  if (gameRunning) {
    setFeedback("Waters are calmer. Keep collecting!", "good");
    scheduleChallenge();
  }
}

function updateScore() {
  scoreDisplay.textContent = score;
}

function updateTime() {
  timeDisplay.textContent = timeLeft;
}

function updateGameTimer() {
  timeLeft -= 1;
  updateTime();

  if (timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerTick);
  clearInterval(obstacleMaker);
  clearTimeout(challengeTimer);
  clearTimeout(challengeEndTimer);
  challengeActive = false;
  updateChallengeStatus("Calm", false);
  gameContainer.classList.remove("challenge-active");
  gameContainer.innerHTML = "";
  startButton.textContent = "Start Game";

  if (score >= TARGET_SCORE) {
    launchCelebration();
    setFeedback(`${pickRandomMessage(winningMessages)} Final score: ${score}`, "good");
  } else {
    clearCelebration();
    setFeedback(`${pickRandomMessage(losingMessages)} Final score: ${score}`, "bad");
  }
}

function resetGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  clearInterval(timerTick);
  clearInterval(obstacleMaker);
  clearTimeout(challengeTimer);
  clearTimeout(challengeEndTimer);
  clearTimeout(celebrationTimeout);

  challengeActive = false;
  score = 0;
  timeLeft = 30;

  updateScore();
  updateTime();
  updateChallengeStatus("Calm", false);

  gameContainer.classList.remove("challenge-active");
  gameContainer.innerHTML = "";
  startButton.textContent = "Start Game";
  clearCelebration();
  setFeedback("Game reset. Press Start Game to play.", "good");
}

function launchCelebration() {
  const confettiColors = ["#ffc907", "#2e9df7", "#4fcb53", "#f5402c", "#ff902a"];

  clearCelebration();
  celebrationOverlay.classList.add("show");

  const text = document.createElement("div");
  text.className = "celebration-text";
  text.textContent = "Clean Water Champion!";
  celebrationOverlay.appendChild(text);

  for (let i = 0; i < 80; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    piece.style.animationDuration = `${Math.random() * 1.6 + 1.7}s`;
    piece.style.animationDelay = `${Math.random() * 0.8}s`;
    celebrationOverlay.appendChild(piece);
  }

  clearTimeout(celebrationTimeout);
  celebrationTimeout = setTimeout(clearCelebration, 2600);
}

function clearCelebration() {
  celebrationOverlay.classList.remove("show");
  celebrationOverlay.innerHTML = "";
}

function pickRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

function updateChallengeStatus(label, isDanger) {
  challengeStatusDisplay.textContent = label;
  challengeStatusDisplay.classList.toggle("danger", isDanger);
}

function setFeedback(message, type) {
  feedbackText.textContent = message;
  feedbackDisplay.classList.remove("good", "bad");

  if (type) {
    feedbackDisplay.classList.add(type);
  }
}
