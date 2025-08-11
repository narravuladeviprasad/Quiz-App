// Shared data and functions
const BANK_KEY = 'neonQuizBank';
const HS_KEY = 'neonQuizHighScores';
const COMPLETED_CATEGORIES_KEY = 'neonQuizCompletedCategories';

// Valid admins
const VALID_ADMINS = {
  'devi prasad': 'deviprasad123',
  'deva': 'deva123',
  'dinesh': 'dinesh123'
};

let quizBank = {
  'General': [
    {
      q: 'Which language runs in a web browser?',
      opts: ['Java', 'C', 'Python', 'JavaScript'],
      a: 3,
      points: 10,
      hint: "It's the language of the web."
    },
    {
      q: 'What does CSS stand for?',
      opts: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style Syntax', 'Code Styling System'],
      a: 1,
      points: 10,
      hint: 'Think cascading.'
    }
  ],
  'Math': [
    {
      q: 'What is 7 * 8?',
      opts: ['54', '56', '58', '63'],
      a: 1,
      points: 8,
      hint: '7*8=56'
    }
  ]
};

// Quiz state variables
let currentCategory = 'General';
let currentQuestionIndex = 0;
let score = 0;
let lives = 3;
let timePerQuestion = 15;
let timeLeft = timePerQuestion;
let timerInterval;
let questions = [];
let quizRunning = false;
let lifelines = {
  fifty: 1,
  hint: 1,
  skip: 2
};
let userId = '';
let playerName = '';

// Load bank from localStorage
function loadBank() {
  const savedBank = localStorage.getItem(BANK_KEY);
  if (savedBank) {
    try {
      quizBank = JSON.parse(savedBank);
    } catch (e) {
      console.error('Failed to parse quiz bank:', e);
    }
  }
}

// Save bank to localStorage
function saveBank() {
  localStorage.setItem(BANK_KEY, JSON.stringify(quizBank));
}

// Initialize the bank
loadBank();

// High scores functions
function loadHighScores() {
  const scores = localStorage.getItem(HS_KEY);
  return scores ? JSON.parse(scores) : [];
}

function saveHighScore(userId, name, score, category) {
  // Validate inputs
  if (!userId || !category) {
    console.error('Attempted to save invalid score:', {userId, name, score, category});
    return;
  }

  const scores = loadHighScores();
  scores.push({ 
    userId: userId || 'guest_' + Date.now(),
    name: name || 'Anonymous',
    score: score || 0,
    category: category || 'General',
    date: new Date().toISOString() 
  });
  
  scores.sort((a, b) => b.score - a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(scores.slice(0, 100)));
}

function markCategoryCompleted(userId, category) {
  const completedData = JSON.parse(localStorage.getItem(COMPLETED_CATEGORIES_KEY) || '{}');
  if (!completedData[userId]) {
    completedData[userId] = [];
  }
  if (!completedData[userId].includes(category)) {
    completedData[userId].push(category);
    localStorage.setItem(COMPLETED_CATEGORIES_KEY, JSON.stringify(completedData));
  }
}

function hasCompletedCategory(userId, category) {
  const completedData = JSON.parse(localStorage.getItem(COMPLETED_CATEGORIES_KEY) || '{}');
  return completedData[userId] && completedData[userId].includes(category);
}

function getCompletedCategories(userId) {
  const completedData = JSON.parse(localStorage.getItem(COMPLETED_CATEGORIES_KEY) || '{}');
  return completedData[userId] || [];
}

function removeCompletedCategory(userId, category) {
  const completedData = JSON.parse(localStorage.getItem(COMPLETED_CATEGORIES_KEY) || '{}');
  if (completedData[userId]) {
    completedData[userId] = completedData[userId].filter(c => c !== category);
    localStorage.setItem(COMPLETED_CATEGORIES_KEY, JSON.stringify(completedData));
  }
}

// Quiz functions
function endQuiz(success) {
  clearInterval(timerInterval);
  quizRunning = false;
  document.getElementById('startBtn').textContent = 'Start Quiz ▼';

  // Always save the score (even if 0)
  saveHighScore(userId, playerName, score, currentCategory);
  markCategoryCompleted(userId, currentCategory);
  showResultsModal(success || currentQuestionIndex >= questions.length);
}

function showResultsModal(success) {
  const modal = document.createElement('div');
  modal.className = 'modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  const title = document.createElement('h2');
  title.textContent = success ? 'Quiz Completed!' : 'Quiz Ended';

  const message = document.createElement('p');
  message.textContent = `Your final score: ${score} points (${currentCategory})`;

  const redirectBtn = document.createElement('button');
  redirectBtn.className = 'btn';
  redirectBtn.textContent = 'Back to Login';
  redirectBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // Auto-redirect after 5 seconds
  let seconds = 5;
  const countdown = document.createElement('p');
  countdown.className = 'small';

  const countdownInterval = setInterval(() => {
    countdown.textContent = `Redirecting in ${seconds} seconds...`;
    seconds--;

    if (seconds < 0) {
      clearInterval(countdownInterval);
      window.location.href = 'index.html';
    }
  }, 1000);

  modalContent.appendChild(title);
  modalContent.appendChild(message);
  modalContent.appendChild(countdown);
  modalContent.appendChild(redirectBtn);
  modal.appendChild(modalContent);

  document.body.appendChild(modal);
}

function startQuiz() {
  currentCategory = document.getElementById('categorySelect').value;

  if (hasCompletedCategory(userId, currentCategory)) {
    alert(`You have already completed the ${currentCategory} quiz!`);
    window.location.href = 'index.html';
    return;
  }

  if (!quizBank[currentCategory] || quizBank[currentCategory].length === 0) {
    alert('No questions available for this category!');
    return;
  }

  questions = [...quizBank[currentCategory]];
  shuffleArray(questions);
  currentQuestionIndex = 0;
  score = 0;
  lives = 3;
  quizRunning = true;

  // Mark category as attempted immediately
  markCategoryCompleted(userId, currentCategory);

  lifelines = {
    fifty: 1,
    hint: 1,
    skip: 2
  };

  updateLifelines();
  document.getElementById('startBtn').textContent = 'End Quiz';
  loadQuestion();
  startTimer();
}

function loadQuestion() {
  if (!questions || questions.length === 0) {
    console.error('No questions loaded!');
    endQuiz(false);
    return;
  }

  if (currentQuestionIndex >= questions.length) {
    endQuiz(true);
    return;
  }

  const question = questions[currentQuestionIndex];
  document.getElementById('question').textContent = question.q;
  document.getElementById('questionNum').textContent = `Q ${currentQuestionIndex + 1}/${questions.length}`;
  document.getElementById('score').textContent = score;

  const optionsContainer = document.getElementById('options');
  optionsContainer.innerHTML = '';
  question.opts.forEach((opt, index) => {
    const button = document.createElement('button');
    button.textContent = `${String.fromCharCode(65 + index)}. ${opt}`;
    button.dataset.index = index;
    button.addEventListener('click', () => selectAnswer(index));
    optionsContainer.appendChild(button);
  });

  document.getElementById('hint').textContent = '';
  timeLeft = timePerQuestion;
  updateTimer();
}

function selectAnswer(selectedIndex) {
  if (!quizRunning) return;

  const question = questions[currentQuestionIndex];
  const options = document.querySelectorAll('#options button');

  options.forEach(opt => opt.disabled = true);

  if (selectedIndex === question.a) {
    options[selectedIndex].classList.add('correct');
    score += question.points;
    document.getElementById('score').textContent = score;
    setTimeout(() => {
      currentQuestionIndex++;
      loadQuestion();
    }, 1000);
  } else {
    options[selectedIndex].classList.add('wrong');
    options[question.a].classList.add('correct');
    lives--;
    if (lives <= 0) {
      setTimeout(() => endQuiz(false), 1000);
    } else {
      setTimeout(() => {
        currentQuestionIndex++;
        loadQuestion();
      }, 1000);
    }
  }
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft -= 0.1;
    updateTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timeLeft = 0;
      updateTimer();
      lives--;
      if (lives <= 0) {
        setTimeout(() => endQuiz(false), 1000);
      } else {
        setTimeout(() => {
          currentQuestionIndex++;
          loadQuestion();
        }, 1000);
      }
    }
  }, 100);
}

function updateTimer() {
  const timerArc = document.getElementById('timerArc');
  const percentage = (timeLeft / timePerQuestion) * 100;
  timerArc.setAttribute('stroke-dasharray', `${percentage} ${100 - percentage}`);
  document.getElementById('timeLeft').textContent = `${Math.ceil(timeLeft)}s`;
}

function useFiftyFifty() {
  if (!quizRunning || lifelines.fifty <= 0) return;

  const question = questions[currentQuestionIndex];
  const options = document.querySelectorAll('#options button');
  const correctIndex = question.a;
  let wrongOptions = [];

  for (let i = 0; i < options.length; i++) {
    if (i !== correctIndex) wrongOptions.push(i);
  }

  for (let i = 0; i < 2 && wrongOptions.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * wrongOptions.length);
    const optionToRemove = wrongOptions.splice(randomIndex, 1)[0];
    options[optionToRemove].style.visibility = 'hidden';
    options[optionToRemove].disabled = true;
  }

  lifelines.fifty--;
  updateLifelines();
}

function useHint() {
  if (!quizRunning || lifelines.hint <= 0) return;

  const question = questions[currentQuestionIndex];
  document.getElementById('hint').textContent = question.hint || 'No hint available for this question.';

  lifelines.hint--;
  updateLifelines();
}

function useSkip() {
  if (!quizRunning || lifelines.skip <= 0) return;

  currentQuestionIndex++;
  loadQuestion();

  lifelines.skip--;
  updateLifelines();
}

function updateLifelines() {
  document.getElementById('fiftyBtn').textContent = `50/50 (${lifelines.fifty})`;
  document.getElementById('fiftyBtn').disabled = lifelines.fifty <= 0;

  document.getElementById('hintBtn').textContent = `Hint (${lifelines.hint})`;
  document.getElementById('hintBtn').disabled = lifelines.hint <= 0;

  document.getElementById('skipBtn').textContent = `Skip (${lifelines.skip})`;
  document.getElementById('skipBtn').disabled = lifelines.skip <= 0;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Page-specific scripts
if (document.querySelector('.login-container')) {
  // Login page scripts
  document.getElementById('userTab').addEventListener('click', () => {
    document.getElementById('userTab').classList.add('active');
    document.getElementById('adminTab').classList.remove('active');
    document.getElementById('userForm').style.display = 'block';
    document.getElementById('adminForm').style.display = 'none';
    document.getElementById('userMessage').textContent = '';
  });

  document.getElementById('adminTab').addEventListener('click', () => {
    document.getElementById('adminTab').classList.add('active');
    document.getElementById('userTab').classList.remove('active');
    document.getElementById('userForm').style.display = 'none';
    document.getElementById('adminForm').style.display = 'block';
    document.getElementById('adminMessage').textContent = '';
  });

  document.getElementById('userLoginBtn').addEventListener('click', () => {
    const inputId = document.getElementById('userid').value.trim();
    const username = document.getElementById('username').value.trim();
    const messageEl = document.getElementById('userMessage');

    if (!/^\d{10}$/.test(inputId)) {
      messageEl.textContent = 'Please enter a valid 10-digit ID';
      messageEl.className = 'message error';
      return;
    }

    if (!username) {
      messageEl.textContent = 'Please enter your name';
      messageEl.className = 'message error';
      return;
    }

    localStorage.setItem('quizUserId', inputId);
    localStorage.setItem('quizUsername', username);
    window.location.href = 'user.html';
  });

  document.getElementById('adminLoginBtn').addEventListener('click', () => {
    const username = document.getElementById('adminName').value.trim().toLowerCase();
    const password = document.getElementById('adminPass').value;
    const messageEl = document.getElementById('adminMessage');

    if (!username || !password) {
      messageEl.textContent = 'Please enter both fields';
      messageEl.className = 'message error';
      return;
    }

    if (VALID_ADMINS[username] !== password) {
      messageEl.textContent = 'Invalid admin credentials';
      messageEl.className = 'message error';
      return;
    }

    localStorage.setItem('quizAdminName', username);
    window.location.href = 'admin.html';
  });
}

if (document.querySelector('.quiz-container')) {
  // User quiz page scripts
  userId = localStorage.getItem('quizUserId');
  playerName = localStorage.getItem('quizUsername') || `User-${userId}`;
  document.getElementById('playerName').textContent = playerName;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = 'index.html';
    }
  });

  // Initialize category select
  const categorySelect = document.getElementById('categorySelect');
  Object.keys(quizBank).forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });

  categorySelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
  });

  // Initialize lifelines
  const fiftyBtn = document.createElement('button');
  fiftyBtn.className = 'lifeline';
  fiftyBtn.textContent = `50/50 (${lifelines.fifty})`;
  fiftyBtn.id = 'fiftyBtn';
  fiftyBtn.addEventListener('click', useFiftyFifty);

  const hintBtn = document.createElement('button');
  hintBtn.className = 'lifeline';
  hintBtn.textContent = `Hint (${lifelines.hint})`;
  hintBtn.id = 'hintBtn';
  hintBtn.addEventListener('click', useHint);

  const skipBtn = document.createElement('button');
  skipBtn.className = 'lifeline';
  skipBtn.textContent = `Skip (${lifelines.skip})`;
  skipBtn.id = 'skipBtn';
  skipBtn.addEventListener('click', useSkip);

  const lifelinesContainer = document.createElement('div');
  lifelinesContainer.className = 'lifelines';
  lifelinesContainer.appendChild(fiftyBtn);
  lifelinesContainer.appendChild(hintBtn);
  lifelinesContainer.appendChild(skipBtn);

  const quizControls = document.querySelector('.quiz-controls');
  quizControls.insertBefore(lifelinesContainer, quizControls.firstChild);

  // Start quiz button
  document.getElementById('startBtn').addEventListener('click', function() {
    if (quizRunning) {
      if (confirm('Are you sure you want to end the quiz?')) {
        endQuiz(false);
      }
    } else {
      startQuiz();
    }
  });
}
function cleanUpInvalidScores() {
  const scores = loadHighScores();
  const validScores = scores.filter(s => s.userId && s.category);
  
  if (scores.length !== validScores.length) {
    localStorage.setItem(HS_KEY, JSON.stringify(validScores));
    console.log(`Cleaned up ${scores.length - validScores.length} invalid scores`);
  }
}

// Call this when admin page loads
if (document.querySelector('.admin-container')) {
  cleanUpInvalidScores();

  // Admin page scripts
  const adminName = localStorage.getItem('quizAdminName') || 'Admin';
  document.getElementById('adminNameDisplay').textContent = adminName;

  document.getElementById('logoutBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      window.location.href = 'index.html';
    }
  });

  document.getElementById('userViewBtn').addEventListener('click', () => {
    window.location.href = 'user.html';
  });

  // Initialize category list
  const categoryList = document.getElementById('categoryList');
  function updateCategoryList() {
    categoryList.innerHTML = '';
    Object.keys(quizBank).forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      option.style.color = 'white';
      categoryList.appendChild(option);
    });
  }
  updateCategoryList();

  // Create user scores section
  const userScoresSection = document.createElement('section');
  userScoresSection.className = 'user-scores';
  userScoresSection.innerHTML = `
    <h3>User Scores</h3>
    <div class="search-box">
      <input type="text" id="scoreSearch" placeholder="Search by ID or name...">
    </div>
    <table>
      <thead>
        <tr>
          <th>User ID</th>
          <th>Name</th>
          <th>Category</th>
          <th>Score</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="scoresTableBody"></tbody>
    </table>
  `;
  
  // Add the section to the admin panel
  document.querySelector('.admin-panel').appendChild(userScoresSection);

  // Function to update user scores table
  function updateUserScoresTable() {
  const scores = loadHighScores();
  const tableBody = document.getElementById('scoresTableBody');
  tableBody.innerHTML = '';

  scores.forEach(score => {
    // Ensure we have required fields, skip invalid entries
    if (!score.userId || !score.category) {
      console.warn('Skipping invalid score entry:', score);
      return;
    }

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${score.userId || 'N/A'}</td>
      <td>${score.name || 'Anonymous'}</td>
      <td>${score.category || 'General'}</td>
      <td>${score.score || 0}</td>
      <td><button class="btn ghost remove-score-btn" 
           data-userid="${score.userId}" 
           data-category="${score.category}">Remove</button></td>
    `;
    tableBody.appendChild(row);
  });

  // Add event listeners to remove buttons
  document.querySelectorAll('.remove-score-btn').forEach(button => {
    button.addEventListener('click', function() {
      const userId = this.getAttribute('data-userid');
      const category = this.getAttribute('data-category');

      // Additional validation
      if (!userId || !category) {
        alert('Cannot remove this score - missing user or category data');
        return;
      }

      if (confirm(`Remove ${userId}'s score for ${category}?`)) {
        // Remove from high scores
        const scores = loadHighScores();
        const updatedScores = scores.filter(s => 
          !(s.userId === userId && s.category === category)
        );
        localStorage.setItem(HS_KEY, JSON.stringify(updatedScores));

        // Remove from completed categories (only if userId exists)
        if (userId && userId !== 'undefined') {
          removeCompletedCategory(userId, category);
        }

        // Refresh the table
        updateUserScoresTable();
      }
    });
  });
}

  // Initialize the scores table when page loads
  updateUserScoresTable();

  // Search functionality
  document.getElementById('scoreSearch').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#scoresTableBody tr').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  });

  // ... rest of your admin page code ...


  // Category management
  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const name = document.getElementById('newCategoryName').value.trim();
    if (!name) return alert('Please enter a category name');
    if (quizBank[name]) return alert('Category already exists');
    quizBank[name] = [];
    saveBank();
    updateCategoryList();
    document.getElementById('newCategoryName').value = '';
  });

  document.getElementById('deleteCategoryBtn').addEventListener('click', () => {
    const category = categoryList.value;
    if (!category) return alert('Please select a category');
    if (!confirm(`Delete category "${category}" and all its questions?`)) return;
    delete quizBank[category];
    saveBank();
    updateCategoryList();
    updateQuestionList();
  });

  // Question management
  function updateQuestionList() {
    const category = categoryList.value;
    const questionList = document.getElementById('questionList');
    questionList.innerHTML = '';

    if (category && quizBank[category]) {
      quizBank[category].forEach((q, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${index + 1}. ${q.q}`;
        option.style.color = 'white';
        questionList.appendChild(option);
      });
    }
  }
  categoryList.addEventListener('change', updateQuestionList);
  updateQuestionList();

  document.getElementById('loadQuestionBtn').addEventListener('click', () => {
    const category = categoryList.value;
    const index = document.getElementById('questionList').value;
    if (!category || index === '') return alert('Please select a category and question');

    const question = quizBank[category][index];
    document.getElementById('questionText').value = question.q;
    document.getElementById('option1').value = question.opts[0];
    document.getElementById('option2').value = question.opts[1];
    document.getElementById('option3').value = question.opts[2];
    document.getElementById('option4').value = question.opts[3];
    document.getElementById('correctIndex').value = question.a;
    document.getElementById('questionPoints').value = question.points;
    document.getElementById('questionHint').value = question.hint || '';

    document.getElementById('editQuestionBtn').dataset.category = category;
    document.getElementById('editQuestionBtn').dataset.index = index;
  });

  document.getElementById('addQuestionBtn').addEventListener('click', () => {
    const category = categoryList.value;
    if (!category) return alert('Please select a category');

    const question = getQuestionFromForm();
    if (!question) return;

    quizBank[category].push(question);
    saveBank();
    updateQuestionList();
    clearQuestionForm();
    alert('Question added successfully');
  });

  document.getElementById('editQuestionBtn').addEventListener('click', () => {
    const category = document.getElementById('editQuestionBtn').dataset.category;
    const index = document.getElementById('editQuestionBtn').dataset.index;
    if (!category || !index) return alert('Please load a question first');

    const question = getQuestionFromForm();
    if (!question) return;

    quizBank[category][index] = question;
    saveBank();
    updateQuestionList();
    alert('Question updated successfully');
  });

  document.getElementById('deleteQuestionBtn').addEventListener('click', () => {
    const category = categoryList.value;
    const index = document.getElementById('questionList').value;
    if (!category || index === '') return alert('Please select a category and question');

    if (!confirm('Delete this question?')) return;

    quizBank[category].splice(index, 1);
    saveBank();
    updateQuestionList();
    clearQuestionForm();
    alert('Question deleted');
  });

  function getQuestionFromForm() {
    const q = document.getElementById('questionText').value.trim();
    const opt1 = document.getElementById('option1').value.trim();
    const opt2 = document.getElementById('option2').value.trim();
    const opt3 = document.getElementById('option3').value.trim();
    const opt4 = document.getElementById('option4').value.trim();
    const correctIndex = parseInt(document.getElementById('correctIndex').value);
    const points = parseInt(document.getElementById('questionPoints').value) || 10;
    const hint = document.getElementById('questionHint').value.trim();

    if (!q || !opt1 || !opt2 || !opt3 || !opt4) {
      alert('Please fill in all fields');
      return null;
    }

    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      alert('Correct index must be between 0 and 3');
      return null;
    }

    return {
      q,
      opts: [opt1, opt2, opt3, opt4],
      a: correctIndex,
      points,
      hint
    };
  }

  function clearQuestionForm() {
    document.getElementById('questionText').value = '';
    document.getElementById('option1').value = '';
    document.getElementById('option2').value = '';
    document.getElementById('option3').value = '';
    document.getElementById('option4').value = '';
    document.getElementById('correctIndex').value = '';
    document.getElementById('questionPoints').value = '10';
    document.getElementById('questionHint').value = '';
  }
}