import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Book,
  FileText,
  Download,
  WifiOff,
  RefreshCw,
  Folder,
  ChevronRight,
  GraduationCap,
  Layout,
  ArrowLeft,
  User,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  UploadCloud,
  File,
  Menu,
  X,
  ChevronUp,
  Edit
} from 'lucide-react';

const API_BASE = '/moodle';

function App() {
  const [isOffline, setIsOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Data State
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [userData, setUserData] = useState(null);
  const [logoutUrl, setLogoutUrl] = useState(null);

  // Navigation State
  const [folderHistory, setFolderHistory] = useState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'course'

  // Mobile State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  // Scroll Listener for Back to Top
  useEffect(() => {
    const handleScroll = () => {
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        setShowScrollTop(mainContent.scrollTop > 300);
      }
    };

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.addEventListener('scroll', handleScroll);
    }
    return () => mainContent?.removeEventListener('scroll', handleScroll);
  }, [isLoggedIn]);

  // Persistence: Save state when view or course changes
  useEffect(() => {
    if (isLoggedIn) {
      localStorage.setItem('lastView', view);
      if (selectedCourse) {
        localStorage.setItem('lastCourseId', selectedCourse.id);
      }
    }
  }, [view, selectedCourse, isLoggedIn]);

  const checkSession = async () => {
    try {
      const res = await axios.get(`${API_BASE}/my/index.php`, { timeout: 60000 });
      const url = res.request.responseURL || '';

      if (!url.includes('/login/index.php')) {
        setIsLoggedIn(true);
        const parser = new DOMParser();
        const doc = parser.parseFromString(res.data, 'text/html');

        extractSessionInfo(doc);
        await fetchUserProfile(doc);
        const coursesFound = await parseCoursesFromDoc(doc);

        // Restore Session State
        const lastView = localStorage.getItem('lastView');
        const lastCourseId = localStorage.getItem('lastCourseId');

        if (lastView === 'course' && lastCourseId && coursesFound.length > 0) {
          const savedCourse = coursesFound.find(c => c.id === lastCourseId);
          if (savedCourse) {
            await fetchMaterials(savedCourse);
          } else {
            setView('dashboard');
          }
        } else {
          setView('dashboard');
        }
      } else {
        setIsLoggedIn(false);
      }
    } catch (e) {
      console.log("Session check failed", e);
      setIsLoggedIn(false);
    } finally {
      setSessionChecking(false);
    }
  };

  const extractSessionInfo = (doc) => {
    const logoutLink = doc.querySelector('a[href*="login/logout.php"]');
    if (logoutLink) {
      let url = logoutLink.getAttribute('href');
      if (url.startsWith('http')) {
        url = url.replace(/https?:\/\/[^\/]+/, API_BASE);
      } else if (url.startsWith('/')) {
        url = `${API_BASE}${url}`;
      }
      setLogoutUrl(url);
    }
  };

  const fetchUserProfile = async (doc) => {
    try {
      let imageUrl = null;
      let fullname = username || 'Student';

      const processUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) {
          return url.replace(/https?:\/\/[^\/]+/, API_BASE);
        }
        return url;
      };

      // Image extraction
      const userNavImg = doc.querySelector('.usermenu .userpicture, .userpicture');
      if (userNavImg) {
        imageUrl = processUrl(userNavImg.getAttribute('src'));
      }

      // Enhanced name extraction from current page
      const nameSelectors = [
        '.usermenu .userbutton .usertext',
        '.userfullname',
        '.contentnode',
        '.user-profile-description',
        '.user-profile-name',
        '.usertext'
      ];

      for (const selector of nameSelectors) {
        const el = doc.querySelector(selector);
        if (el && el.textContent.trim()) {
          const text = el.textContent.trim();
          if (text && text !== username && text !== 'Student') {
            fullname = text;
            break;
          }
        }
      }

      // Deep extraction if profile link exists and we still have a placeholder
      const profileLink = doc.querySelector('a[href*="/user/profile.php"]');
      if (profileLink && (fullname === 'Student' || fullname === username)) {
        let url = profileLink.getAttribute('href');
        url = processUrl(url);
        try {
          const res = await axios.get(url, { timeout: 30000 });
          const userDoc = new DOMParser().parseFromString(res.data, 'text/html');
          const nameEl = userDoc.querySelector('.page-header-headings h1, .page-header h1, h1.h2, .contentnode, .userfullname');
          if (nameEl && nameEl.textContent.trim()) {
            fullname = nameEl.textContent.trim();
          }
          const profileImg = userDoc.querySelector('.userpicture');
          if (profileImg) imageUrl = processUrl(profileImg.getAttribute('src'));
        } catch (e) { console.log("Profile deep fetch failed"); }
      }

      setUserData({ username: fullname, imageUrl });
    } catch (e) {
      setUserData({ username: username || 'Student', imageUrl: null });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      let loginPageRes = await axios.get(`${API_BASE}/login/index.php`);
      if (!loginPageRes.request.responseURL.includes('/login/index.php')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(loginPageRes.data, 'text/html');
        const logoutLink = doc.querySelector('a[href*="login/logout.php"]');
        if (logoutLink) {
          let url = logoutLink.getAttribute('href');
          if (url.startsWith('http')) url = url.replace(/https?:\/\/[^\/]+/, API_BASE);
          else if (url.startsWith('/')) url = `${API_BASE}${url}`;
          await axios.get(url);
          loginPageRes = await axios.get(`${API_BASE}/login/index.php`);
        } else {
          setIsLoggedIn(true);
          await checkSession();
          setLoading(false);
          return;
        }
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(loginPageRes.data, 'text/html');
      const tokenInput = doc.querySelector('input[name="logintoken"]');
      const loginToken = tokenInput ? tokenInput.value : '';

      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('logintoken', loginToken);
      formData.append('anchor', '');
      formData.append('rememberusername', '1');

      const loginRes = await axios.post(`${API_BASE}/login/index.php`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 5
      });

      const postUrl = loginRes.request.responseURL || '';
      if (postUrl.includes('/login/index.php') || loginRes.data.includes('loginerrormessage')) {
        const failedDoc = new DOMParser().parseFromString(loginRes.data, 'text/html');
        const errorMsg = failedDoc.querySelector('.loginerrors .error, .notifyproblem, .alert-danger')?.textContent
          || "Login failed. Check your credentials.";
        setLoginError(errorMsg.trim());
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);
      await fetchMyCourses();
    } catch (error) {
      if (error.code === 'ERR_NETWORK' || !error.response) setIsOffline(true);
      else setLoginError(`Login Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (logoutUrl) {
      try { await axios.get(logoutUrl); } catch (e) { }
    }
    setIsLoggedIn(false);
    setUserData(null);
    setCourses([]);
    setSelectedCourse(null);
    setLogoutUrl(null);
    setMaterials([]);
    setUsername('');
    setPassword('');
    setView('dashboard');
    setMobileMenuOpen(false);
    localStorage.removeItem('lastView');
    localStorage.removeItem('lastCourseId');
  };

  const fetchMyCourses = async () => {
    setLoading(true);
    setCourses([]);
    try {
      const response = await axios.get(`${API_BASE}/my/index.php`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'text/html');
      extractSessionInfo(doc);
      await fetchUserProfile(doc);
      await parseCoursesFromDoc(doc);
      setView('dashboard');
    } catch (error) {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const parseCoursesFromDoc = async (doc) => {
    const courseMap = new Map();
    const dashboardItems = doc.querySelectorAll('.dashboard-card, .course-summaryitem, .coursebox, .card');
    dashboardItems.forEach(item => {
      const anchor = item.querySelector('a[href*="/course/view.php"]');
      if (anchor) {
        const href = anchor.getAttribute('href');
        const match = href.match(/id=(\d+)/);
        if (match && match[1] !== '1') {
          const id = match[1];
          const titleEl = item.querySelector('.coursename, .fullname, h3, h4, h5');
          const name = titleEl ? titleEl.textContent.trim() : anchor.textContent.trim();
          if (name && !courseMap.has(id)) courseMap.set(id, { id, name, url: href });
        }
      }
    });

    const navLinks = doc.querySelectorAll('.block_navigation .type_course a[href*="/course/view.php"]');
    navLinks.forEach(link => {
      const match = link.getAttribute('href').match(/id=(\d+)/);
      if (match && match[1] !== '1') {
        const id = match[1];
        if (!courseMap.has(id)) courseMap.set(id, { id, name: link.textContent.trim() || link.title, url: link.href });
      }
    });

    const list = Array.from(courseMap.values());
    setCourses(list);
    return list;
  };

  const rewriteUrl = (url) => {
    if (!url) return '';
    return url.replace(/https?:\/\/20\.0\.121\.215/g, API_BASE);
  };

  const fetchMaterials = async (course) => {
    setLoading(true);
    setSelectedCourse(course);
    setView('course');
    setMaterials([]);
    setFolderHistory([]);
    setMobileMenuOpen(false);

    try {
      const response = await axios.get(`${API_BASE}/course/view.php?id=${course.id}`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'text/html');
      const activityNodes = doc.querySelectorAll('.activity');
      let mats = Array.from(activityNodes).map(node => {
        const anchor = node.querySelector('a');
        if (!anchor) return null;
        const instanceName = node.querySelector('.instancename, .activityname');
        const text = instanceName ? instanceName.childNodes[0].textContent.trim() : anchor.textContent.trim();
        const href = rewriteUrl(anchor.getAttribute('href'));
        let type = 'file';
        if (node.className.includes('folder')) type = 'folder';
        else if (node.className.includes('url')) type = 'url';
        else if (node.className.includes('assign')) type = 'assignment';
        const workKeywords = ['assignment', 'task', 'project', 'submission', 'homework', 'quiz', 'lab work'];
        if (workKeywords.some(kw => text.toLowerCase().includes(kw))) type = 'assignment';
        if (text.includes('Announcements') || text.includes('Attendance')) return null;
        return { id: href, name: text, url: href, type };
      }).filter(Boolean);

      if (mats.length === 0) {
        const resourceLinks = doc.querySelectorAll('a[href*="/mod/"]');
        mats = Array.from(resourceLinks).map(link => {
          const href = rewriteUrl(link.href);
          if (href.includes('forum') || href.includes('label')) return null;
          let type = 'file';
          if (href.includes('folder')) type = 'folder';
          else if (href.includes('assign')) type = 'assignment';
          else if (href.includes('url')) type = 'url';
          const name = link.textContent.trim();
          const workKeywords = ['assignment', 'task', 'project', 'submission', 'homework', 'quiz', 'lab work'];
          if (workKeywords.some(kw => name.toLowerCase().includes(kw))) type = 'assignment';
          return { id: href, name, url: href, type };
        }).filter(Boolean);
      }
      setMaterials(mats);
    } catch (error) {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = async (folder) => {
    setLoading(true);
    try {
      setFolderHistory([...folderHistory, { name: folder.name, materials }]);
      setMaterials([]);
      const response = await axios.get(folder.url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(response.data, 'text/html');
      const regionMain = doc.querySelector('[role="main"], .region-main') || doc.body;
      let links = Array.from(regionMain.querySelectorAll('.fp-filename-icon a, .fp-filename a, .activityinstance a'));
      const folderMats = links.map(link => {
        const href = rewriteUrl(link.href);
        let name = link.textContent.trim();
        let type = 'file';
        if (href.includes('/mod/folder/')) type = 'folder';
        else if (href.includes('/mod/assign/')) type = 'assignment';
        if (!name || name.includes('Download folder')) return null;
        return { id: href, name, url: href, type };
      }).filter(Boolean);
      setMaterials(folderMats);
    } catch (err) {
      if (folderHistory.length > 0) {
        const prev = folderHistory[folderHistory.length - 1];
        setMaterials(prev.materials);
        setFolderHistory(folderHistory.slice(0, -1));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (folderHistory.length === 0) return;
    const prev = folderHistory[folderHistory.length - 1];
    setMaterials(prev.materials);
    setFolderHistory(folderHistory.slice(0, -1));
  };

  if (isOffline) {
    return (
      <div className="offline-container">
        <WifiOff className="offline-icon" />
        <h1 className="offline-title">Connection Lost</h1>
        <button className="btn" onClick={() => { setIsOffline(false); setLoginError(null); }}><RefreshCw size={20} /> Try Again</button>
      </div>
    );
  }

  if (sessionChecking) {
    return (
      <div className="login-page-container">
        <div style={{ color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RefreshCw size={32} className="spinner" style={{ marginBottom: '1rem' }} />
          <p>Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="login-page-container">
        <div className="login-card">
          <div className="login-logo"><GraduationCap size={48} /><h1 className="login-title">MITS Moodle Login</h1></div>
          <form onSubmit={handleLogin} className="login-form">
            {loginError && <div className="error-msg">{loginError}</div>}
            <div className="form-group"><label className="form-label">Username</label><input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter ID" /></div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-container">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter Password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-block" disabled={loading}>
              {loading ? <RefreshCw className="spinner" size={18} style={{ color: 'white' }} /> : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
      <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header"><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GraduationCap size={28} /><span>MITS Moodle</span></div><button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(false)}><X size={24} color="#94a3b8" /></button></div>
        <div className="course-scroll-area">
          <div className="section-title">My Enrolled Courses</div>
          <div className="course-list">{courses.map(course => (<div key={course.id} className={`sidebar-item ${selectedCourse?.id === course.id ? 'active' : ''}`} onClick={() => fetchMaterials(course)}><Book size={18} /><span>{course.name}</span></div>))}</div>
        </div>
      </div>
      <div className="main-content" onClick={() => profileOpen && setProfileOpen(false)}>
        <div className="top-nav-profile">
          <button className="profile-trigger" onClick={(e) => { e.stopPropagation(); setProfileOpen(!profileOpen); }}>{userData?.imageUrl ? <img src={userData.imageUrl} alt="P" /> : <User size={24} />}</button>
          {profileOpen && (
            <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-user-info"><div className="dropdown-user-name">{userData?.username || 'Student'}</div></div>
              <div className="dropdown-menu-item" onClick={() => window.open(`${API_BASE}/user/profile.php`, '_blank')}><Edit size={16} /> Edit Profile</div>
              <div className="dropdown-menu-item logout" onClick={handleLogout}><LogOut size={16} /> Log Out</div>
            </div>
          )}
        </div>
        <div className="mobile-header-row">
          <button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
            <GraduationCap size={24} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>MITS Moodle</span>
          </div>
        </div>
        {!selectedCourse ? (
          <div className="empty-state"><Layout size={64} className="empty-icon" /><h2>Select a course to view materials</h2></div>
        ) : (
          <>
            <div className="content-header">
              {folderHistory.length > 0 && (<button onClick={handleBack} className="btn-outline"><ArrowLeft size={18} /> Back</button>)}
              <h1 className="content-title">{folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].name : selectedCourse.name}</h1>
            </div>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#94a3b8', marginTop: '2rem' }}>
                <RefreshCw className="spinner" size={20} />
                <span>Loading materials...</span>
              </div>
            ) : materials.length > 0 ? (
              <div className="resource-list">
                {materials.map((mat, idx) => (
                  <div key={idx} className="resource-item">
                    <div className="resource-info"><div className="card-icon">{mat.type === 'folder' ? <Folder /> : mat.type === 'url' ? <Book /> : <FileText />}</div><div><div style={{ fontWeight: 600 }}>{mat.name}</div><div style={{ fontSize: '0.8rem', color: '#64748b' }}>{mat.type} Resource</div></div></div>
                    {mat.type === 'folder' ? (<button onClick={() => handleFolderClick(mat)} className="btn"><ChevronRight size={16} /> Open</button>) : (
                      <a href={mat.url} target="_blank" rel="noopener noreferrer" className="btn">
                        {mat.type === 'url' ? <ChevronRight size={16} /> : (mat.type === 'assignment' ? <UploadCloud size={16} /> : <Download size={16} />)}
                        {mat.type === 'url' ? 'Open' : (mat.type === 'assignment' ? 'Upload' : 'Download')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (<div className="empty-state"><p>No materials found.</p></div>)}
          </>
        )}
        <button className={`back-to-top ${showScrollTop ? 'visible' : ''}`} onClick={() => { document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' }); }}><ChevronUp size={24} /></button>
      </div>
    </div>
  );
}

export default App;
