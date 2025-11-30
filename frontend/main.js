const socket = io();

let authToken = null;
let currentUser = null;

let currentSection = 'feed';
let currentChatUser = null;   // user object you're chatting with
let currentRoomId = null;     // private roomId for pair

// ===== DOM =====
const authScreen = document.getElementById('authScreen');
const app = document.getElementById('app');

const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginStatus = document.getElementById('loginStatus');
const signupStatus = document.getElementById('signupStatus');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const signupUsername = document.getElementById('signupUsername');
const signupEmail = document.getElementById('signupEmail');
const signupPassword = document.getElementById('signupPassword');

const navUsername = document.getElementById('navUsername');
const navAvatar = document.getElementById('navAvatar');
const logoutBtn = document.getElementById('logoutBtn');
const navHome = document.getElementById('navHome');
const navChat = document.getElementById('navChat');
const navProfileBtn = document.getElementById('navProfileBtn');

const sideButtons = document.querySelectorAll('.side-btn');
const feedSection = document.getElementById('feedSection');
const chatSection = document.getElementById('chatSection');
const profileSection = document.getElementById('profileSection');

const newPostForm = document.getElementById('newPostForm');
const postImageInput = document.getElementById('postImageInput');
const postCaption = document.getElementById('postCaption');
const feedContainer = document.getElementById('feedContainer');
const newPostAvatar = document.getElementById('newPostAvatar');

const profileUsername = document.getElementById('profileUsername');
const profileEmail = document.getElementById('profileEmail');
const profileAvatar = document.getElementById('profileAvatar');
const profileForm = document.getElementById('profileForm');
const bioInput = document.getElementById('bioInput');
const avatarInput = document.getElementById('avatarInput');

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const chatMessages = document.getElementById('chatMessages');
const chatMessageInput = document.getElementById('chatMessageInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const chatAttachBtn = document.getElementById('chatAttachBtn');
const chatFileInput = document.getElementById('chatFileInput');
const chatHeaderTitle = document.getElementById('chatHeaderTitle');
const chatHeaderSubtitle = document.getElementById('chatHeaderSubtitle');

const bigProfileAvatar = document.getElementById('bigProfileAvatar');
const bigProfileUsername = document.getElementById('bigProfileUsername');
const bigProfileBio = document.getElementById('bigProfileBio');
const profileMessageBtn = document.getElementById('profileMessageBtn');

// ===== UTILS =====
function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('instalite_token', token);
  } else {
    localStorage.removeItem('instalite_token');
  }
}

function authHeaders() {
  return {
    Authorization: `Bearer ${authToken}`
  };
}

function setCurrentUser(user) {
  currentUser = user;
  if (!user) return;

  navUsername.textContent = user.username;
  profileUsername.textContent = user.username;
  profileEmail.textContent = user.email;
  bioInput.value = user.bio || '';

  const initials = user.username
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function applyAvatar(el) {
    el.style.backgroundImage = '';
    el.textContent = initials;
    if (user.avatarUrl) {
      el.style.backgroundImage = `url(${user.avatarUrl})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    }
  }

  applyAvatar(navAvatar);
  applyAvatar(newPostAvatar);
  applyAvatar(profileAvatar);
}

function showApp() {
  authScreen.classList.add('hidden');
  app.classList.remove('hidden');
}

function showAuth() {
  authScreen.classList.remove('hidden');
  app.classList.add('hidden');
}

// ===== TAB SWITCH (login/signup) =====
loginTab.addEventListener('click', () => {
  loginTab.classList.add('active');
  signupTab.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
});

signupTab.addEventListener('click', () => {
  signupTab.classList.add('active');
  loginTab.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

// ===== AUTH FLOW =====

// Try existing token
(async function initAuth() {
  const stored = localStorage.getItem('instalite_token');
  if (!stored) return;

  setToken(stored);
  try {
    const res = await fetch('/api/users/me', {
      headers: authHeaders()
    });
    if (!res.ok) throw new Error('Invalid token');
    const user = await res.json();
    setCurrentUser(user);
    showApp();
    initMainFeatures();
  } catch (err) {
    setToken(null);
    showAuth();
  }
})();

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginStatus.textContent = '';
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: loginEmail.value.trim(),
        password: loginPassword.value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      loginStatus.textContent = data.error || 'Login failed';
      return;
    }
    setToken(data.token);
    setCurrentUser(data.user);
    showApp();
    initMainFeatures();
  } catch (err) {
    loginStatus.textContent = 'Network error';
  }
});

signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  signupStatus.textContent = '';
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: signupUsername.value.trim(),
        email: signupEmail.value.trim(),
        password: signupPassword.value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      signupStatus.textContent = data.error || 'Signup failed';
      return;
    }
    setToken(data.token);
    setCurrentUser(data.user);
    showApp();
    initMainFeatures();
  } catch (err) {
    signupStatus.textContent = 'Network error';
  }
});

logoutBtn.addEventListener('click', () => {
  setToken(null);
  currentUser = null;
  showAuth();
});

// ===== MAIN FEATURES (once logged in) =====

let featuresInitialized = false;

function initMainFeatures() {
  if (featuresInitialized) return;
  featuresInitialized = true;

  // Sidebar navigation
  sideButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sideButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchSection(btn.dataset.section);
    });
  });

  // Top nav buttons
  navHome.addEventListener('click', () => {
    activateSectionButton('feed');
  });
  navChat.addEventListener('click', () => {
    activateSectionButton('chat');
  });
  navProfileBtn.addEventListener('click', () => {
    activateSectionButton('profile');
    showOwnProfilePage();
  });

  // Feed
  loadFeed();
  newPostForm.addEventListener('submit', handleNewPost);

  // Profile (current user)
  profileForm.addEventListener('submit', handleProfileUpdate);
  avatarInput.addEventListener('change', handleAvatarUpload);

  // Search users
  setupSearch();

  // Chat
  chatSendBtn.addEventListener('click', sendChatMessage);
  chatMessageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });
  chatAttachBtn.addEventListener('click', () => chatFileInput.click());
  chatFileInput.addEventListener('change', handleChatFile);

  socket.on('newMessage', msg => {
    if (msg.roomId === currentRoomId) {
      renderChatMessage(msg);
    }
  });

  // When "Chats" side button clicked, if we already have a chat user, load history
  sideButtons.forEach(btn => {
    if (btn.dataset.section === 'chat') {
      btn.addEventListener('click', () => {
        if (currentChatUser && currentRoomId) {
          loadChatHistory(currentRoomId);
        }
      });
    }
  });

  profileMessageBtn.addEventListener('click', () => {
    if (!currentChatUser) return;
    activateSectionButton('chat');
    // history will be loaded automatically when we switch
    loadChatHistory(currentRoomId);
  });
}

function activateSectionButton(section) {
  sideButtons.forEach(b => {
    if (b.dataset.section === section) b.classList.add('active');
    else b.classList.remove('active');
  });
  switchSection(section);
}

function switchSection(section) {
  currentSection = section;
  if (section === 'feed') {
    feedSection.classList.remove('hidden');
    chatSection.classList.add('hidden');
    profileSection.classList.add('hidden');
  } else if (section === 'chat') {
    chatSection.classList.remove('hidden');
    feedSection.classList.add('hidden');
    profileSection.classList.add('hidden');
    if (currentChatUser && currentRoomId) {
      loadChatHistory(currentRoomId);
    }
  } else if (section === 'profile') {
    profileSection.classList.remove('hidden');
    feedSection.classList.add('hidden');
    chatSection.classList.add('hidden');
    showOwnProfilePage();
  }
}

// ===== FEED =====

async function loadFeed() {
  feedContainer.innerHTML = 'Loading...';
  try {
    const res = await fetch('/api/posts/feed', {
      headers: authHeaders()
    });
    const posts = await res.json();
    renderFeed(posts);
  } catch (err) {
    feedContainer.textContent = 'Failed to load feed.';
  }
}

function renderFeed(posts) {
  feedContainer.innerHTML = '';
  posts.forEach(post => {
    const card = document.createElement('div');
    card.className = 'post-card';

    const header = document.createElement('div');
    header.className = 'post-header';
    const avatar = document.createElement('div');
    avatar.className = 'nav-avatar small';
    const initials = post.user.username
      .split(' ')
      .map(p => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    avatar.textContent = initials;
    if (post.user.avatarUrl) {
      avatar.style.backgroundImage = `url(${post.user.avatarUrl})`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';
      avatar.textContent = '';
    }

    const metaBox = document.createElement('div');
    const nameSpan = document.createElement('div');
    nameSpan.className = 'post-username';
    nameSpan.textContent = post.user.username;
    const timeSpan = document.createElement('div');
    timeSpan.className = 'post-time';
    timeSpan.textContent = new Date(post.createdAt).toLocaleString();
    metaBox.appendChild(nameSpan);
    metaBox.appendChild(timeSpan);

    header.appendChild(avatar);
    header.appendChild(metaBox);

    const imgWrap = document.createElement('div');
    imgWrap.className = 'post-image-wrapper';
    const img = document.createElement('img');
    img.className = 'post-image';
    img.src = post.imageUrl;
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'post-body';

    const captionDiv = document.createElement('div');
    captionDiv.className = 'post-caption';
    captionDiv.textContent = post.caption;

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'post-like-btn';
    likeBtn.innerHTML = '♡';

    const liked = (post.likes || []).includes(currentUser?.id);
    if (liked) likeBtn.classList.add('liked');

    const likeCountSpan = document.createElement('span');
    likeCountSpan.textContent = ` ${(post.likes || []).length} likes`;

    likeBtn.addEventListener('click', async () => {
      const res = await fetch(`/api/posts/${post._id}/like`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      likeCountSpan.textContent = ` ${data.likesCount} likes`;
      if (data.liked) {
        likeBtn.classList.add('liked');
      } else {
        likeBtn.classList.remove('liked');
      }
    });

    actions.appendChild(likeBtn);
    actions.appendChild(likeCountSpan);

    body.appendChild(captionDiv);
    body.appendChild(actions);

    card.appendChild(header);
    card.appendChild(imgWrap);
    card.appendChild(body);

    feedContainer.appendChild(card);
  });

  if (!posts.length) {
    feedContainer.textContent = 'No posts yet. Be the first to share!';
  }
}

async function handleNewPost(e) {
  e.preventDefault();
  if (!postImageInput.files.length) {
    alert('Select an image');
    return;
  }

  const formData = new FormData();
  formData.append('image', postImageInput.files[0]);
  formData.append('caption', postCaption.value);

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    if (!res.ok) {
      alert('Failed to create post');
      return;
    }
    postCaption.value = '';
    postImageInput.value = '';
    loadFeed();
  } catch (err) {
    alert('Network error when creating post');
  }
}

// ===== PROFILE (CURRENT USER) =====

async function handleProfileUpdate(e) {
  e.preventDefault();
  try {
    const res = await fetch('/api/users/me', {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ bio: bioInput.value })
    });
    const user = await res.json();
    setCurrentUser(user);
    if (currentSection === 'profile') {
      showOwnProfilePage();
    }
  } catch (err) {
    alert('Failed to update profile');
  }
}

async function handleAvatarUpload() {
  if (!avatarInput.files.length) return;
  const formData = new FormData();
  formData.append('avatar', avatarInput.files[0]);

  try {
    const res = await fetch('/api/users/me/avatar', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    const user = await res.json();
    setCurrentUser(user);
    if (currentSection === 'profile') {
      showOwnProfilePage();
    }
  } catch (err) {
    alert('Failed to upload avatar');
  }
}

function showOwnProfilePage() {
  if (!currentUser) return;
  bigProfileUsername.textContent = currentUser.username;
  bigProfileBio.textContent = currentUser.bio || 'No bio yet.';
  profileMessageBtn.classList.add('hidden'); // no "Message" button for yourself

  const initials = currentUser.username
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  bigProfileAvatar.style.backgroundImage = '';
  bigProfileAvatar.textContent = initials;
  if (currentUser.avatarUrl) {
    bigProfileAvatar.style.backgroundImage = `url(${currentUser.avatarUrl})`;
    bigProfileAvatar.style.backgroundSize = 'cover';
    bigProfileAvatar.style.backgroundPosition = 'center';
    bigProfileAvatar.textContent = '';
  }
}

// ===== SEARCH USERS & OPEN PROFILES/CHATS =====

function setupSearch() {
  let searchTimeout = null;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!q) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(() => {
      searchUsers(q);
    }, 250);
  });

  document.addEventListener('click', e => {
    if (!searchResults.contains(e.target) && e.target !== searchInput) {
      searchResults.classList.add('hidden');
    }
  });
}

async function searchUsers(q) {
  try {
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders()
    });
    const users = await res.json();
    renderSearchResults(users);
  } catch (err) {
    console.error('Search error', err);
  }
}

function renderSearchResults(users) {
  searchResults.innerHTML = '';
  if (!users.length) {
    const empty = document.createElement('div');
    empty.className = 'search-results-item';
    empty.textContent = 'No users found';
    searchResults.appendChild(empty);
  } else {
    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'search-results-item';

      const avatar = document.createElement('div');
      avatar.className = 'search-avatar';
      const initials = u.username
        .split(' ')
        .map(p => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      avatar.textContent = initials;
      if (u.avatarUrl) {
        avatar.style.backgroundImage = `url(${u.avatarUrl})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.textContent = '';
      }

      const info = document.createElement('div');
      info.className = 'search-info';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'search-username';
      nameSpan.textContent = u.username;
      const bioSpan = document.createElement('span');
      bioSpan.className = 'search-bio';
      bioSpan.textContent = u.bio || '';

      info.appendChild(nameSpan);
      info.appendChild(bioSpan);

      item.appendChild(avatar);
      item.appendChild(info);

      item.addEventListener('click', () => {
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        searchInput.value = u.username;

        openUserProfile(u);
      });

      searchResults.appendChild(item);
    });
  }

  searchResults.classList.remove('hidden');
}

function openUserProfile(user) {
  activateSectionButton('profile');

  bigProfileUsername.textContent = user.username;
  bigProfileBio.textContent = user.bio || 'No bio yet.';

  const initials = user.username
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  bigProfileAvatar.style.backgroundImage = '';
  bigProfileAvatar.textContent = initials;
  if (user.avatarUrl) {
    bigProfileAvatar.style.backgroundImage = `url(${user.avatarUrl})`;
    bigProfileAvatar.style.backgroundSize = 'cover';
    bigProfileAvatar.style.backgroundPosition = 'center';
    bigProfileAvatar.textContent = '';
  }

  // Set current chat user & roomId for private chat
  currentChatUser = user;
  currentRoomId = makeRoomId(currentUser.id, user.id);

  profileMessageBtn.classList.remove('hidden');
}

// Helper: generate private room id from two user ids
function makeRoomId(id1, id2) {
  return [id1, id2].sort().join('_');
}

// ===== CHAT (PRIVATE) =====

async function loadChatHistory(roomId) {
  if (!roomId) return;
  chatMessages.innerHTML = '';
  try {
    const res = await fetch(`/api/messages/${roomId}`, {
      headers: authHeaders()
    });
    const msgs = await res.json();
    msgs.forEach(renderChatMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    chatMessages.textContent = 'Failed to load messages.';
  }
}

function renderChatMessage(msg) {
  const isSelf = msg.sender === currentUser.username;

  const row = document.createElement('div');
  row.className = 'chat-msg-row' + (isSelf ? ' self' : '');

  const meta = document.createElement('div');
  meta.className = 'chat-meta';
  meta.textContent = `${msg.sender} • ${new Date(msg.createdAt).toLocaleTimeString()}`;
  row.appendChild(meta);

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (msg.text) {
    bubble.textContent = msg.text;
  }

  if (msg.fileUrl) {
    const link = document.createElement('a');
    link.href = msg.fileUrl;
    link.target = '_blank';
    link.className = 'chat-file';
    link.textContent = msg.fileName || 'Download file';
    bubble.appendChild(document.createElement('br'));
    bubble.appendChild(link);
  }

  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
  if (!currentChatUser || !currentRoomId) {
    alert('Search a user and open their profile to start a private chat.');
    return;
  }

  const text = chatMessageInput.value.trim();
  if (!text && !pendingChatFile) return;

  const payload = {
    roomId: currentRoomId,
    sender: currentUser.username,
    text,
    fileUrl: pendingChatFile?.fileUrl || null,
    fileName: pendingChatFile?.originalName || null
  };

  // join that room
  socket.emit('joinRoom', currentRoomId);
  socket.emit('sendMessage', payload);

  chatMessageInput.value = '';
  chatMessageInput.placeholder = 'Message...';
  pendingChatFile = null;

  // update header
  chatHeaderTitle.textContent = currentChatUser.username;
  chatHeaderSubtitle.textContent = 'Private chat';
}

let pendingChatFile = null;

async function handleChatFile() {
  if (!chatFileInput.files.length) return;
  const formData = new FormData();
  formData.append('file', chatFileInput.files[0]);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: formData
    });
    const data = await res.json();
    pendingChatFile = data;
    chatMessageInput.placeholder = `Attached: ${data.originalName}. Type a message or send.`;
  } catch (err) {
    alert('Failed to upload file');
  }
}
