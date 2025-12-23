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
  X
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
  const [privateFiles, setPrivateFiles] = useState([]);
  const [userData, setUserData] = useState(null);
  const [logoutUrl, setLogoutUrl] = useState(null);

  // Navigation State
  const [folderHistory, setFolderHistory] = useState([]);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'course', 'upload'

  // Mobile State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

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
      const res = await axios.get(`${API_BASE}/my/index.php`);
      const url = res.request.responseURL || '';

      if (!url.includes('/login/index.php')) {
        setIsLoggedIn(true);
        const parser = new DOMParser();
        const doc = parser.parseFromString(res.data, 'text/html');

        extractSessionInfo(doc);
        fetchUserProfile(doc);
        const coursesFound = await parseCoursesFromDoc(doc);

        // Restore Session State
        const lastView = localStorage.getItem('lastView');
        const lastCourseId = localStorage.getItem('lastCourseId');

        if (lastView === 'upload') {
          // Restore Private Files View
          await fetchPrivateFiles();
        } else if (lastView === 'course' && lastCourseId && coursesFound.length > 0) {
          // Restore Course View
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
        // Not logged in
        setIsLoggedIn(false);
      }
    } catch (e) {
      console.log("Session check failed", e);
      // On reload, if we can't reach the server, just show login screen instead of blocking offline error
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

      const userNavImg = doc.querySelector('.usermenu .userpicture, .usermenu .userpicture, .userpicture');
      if (userNavImg) {
        imageUrl = processUrl(userNavImg.getAttribute('src'));
      }

      const profileLink = doc.querySelector('a[href*="/user/profile.php"]');

      if (profileLink) {
        let url = profileLink.getAttribute('href');
        url = processUrl(url);

        const res = await axios.get(url);
        const userDoc = new DOMParser().parseFromString(res.data, 'text/html');

        const nameEl = userDoc.querySelector('.page-header-headings h1, .page-header h1, h1.h2');
        if (nameEl) {
          fullname = nameEl.textContent.trim();
        }

        const profileImg = userDoc.querySelector('.userpicture');
        if (profileImg) {
          imageUrl = processUrl(profileImg.getAttribute('src'));
        }

        extractSessionInfo(userDoc);
      } else {
        const userMenu = doc.querySelector('.usertext, .userbutton, .user-profile-name, .dropdown-toggle .userpicture');
        if (userMenu && !fullname) {
          fullname = userMenu.textContent.trim();
        }
      }

      setUserData({ username: fullname, imageUrl });

    } catch (e) {
      console.error("Fetch profile failed", e);
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
        console.log("Active session detected during login. Logging out to force new authentication.");

        const parser = new DOMParser();
        const doc = parser.parseFromString(loginPageRes.data, 'text/html');
        const logoutLink = doc.querySelector('a[href*="login/logout.php"]');

        if (logoutLink) {
          let url = logoutLink.getAttribute('href');
          if (url.startsWith('http')) {
            url = url.replace(/https?:\/\/[^\/]+/, API_BASE);
          } else if (url.startsWith('/')) {
            url = `${API_BASE}${url}`;
          }
          await axios.get(url);
          loginPageRes = await axios.get(`${API_BASE}/login/index.php`);
        } else {
          setIsLoggedIn(true);
          setSessionChecking(true);
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
      setUserData({ username });
      await fetchMyCourses(); // Default to courses

    } catch (error) {
      console.error("Login error", error);
      if (error.code === 'ERR_NETWORK' || !error.response) {
        setIsOffline(true);
      } else {
        setLoginError(`Login Error: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (logoutUrl) {
      try {
        await axios.get(logoutUrl);
      } catch (e) {
        console.warn("Logout endpoint failed, but clearing local state", e);
      }
    }

    setIsLoggedIn(false);
    setUserData(null);
    setCourses([]);
    setSelectedCourse(null);
    setLogoutUrl(null);
    setMaterials([]);
    setPrivateFiles([]);
    setUsername('');
    setPassword('');
    setView('dashboard');
    setMobileMenuOpen(false);

    // Clear persistence
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
      fetchUserProfile(doc);
      const list = await parseCoursesFromDoc(doc);

      setView('dashboard');
      return list;
    } catch (error) {
      console.error("Fetch courses error", error);
      setIsOffline(true);
      return [];
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
        if (match) {
          const id = match[1];
          if (id !== '1') {
            let name = '';
            const titleEl = item.querySelector('.coursename, .fullname, h3, h4, h5');
            name = titleEl ? titleEl.textContent.trim() : anchor.textContent.trim();
            if (name.toLowerCase() === 'course') name = '';
            if (name && !courseMap.has(id)) {
              courseMap.set(id, { id, name, url: href });
            }
          }
        }
      }
    });

    const navLinks = doc.querySelectorAll('.block_navigation .type_course a[href*="/course/view.php"]');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/id=(\d+)/);
      if (match) {
        const id = match[1];
        if (id !== '1' && !courseMap.has(id)) {
          courseMap.set(id, {
            id,
            name: link.textContent.trim() || link.title,
            url: href
          });
        }
      }
    });

    const menuLinks = doc.querySelectorAll('.dropdown-menu a[href*="/course/view.php"], .nav-item .dropdown-menu a[href*="/course/view.php"]');
    menuLinks.forEach(link => {
      const href = link.getAttribute('href');
      const match = href.match(/id=(\d+)/);
      if (match) {
        const id = match[1];
        if (id !== '1' && !courseMap.has(id)) {
          courseMap.set(id, {
            id,
            name: link.textContent.trim(),
            url: href
          });
        }
      }
    });

    if (courseMap.size === 0) {
      const frontPageLinks = doc.querySelectorAll('.frontpage-course-list-enrolled .coursebox a[href*="/course/view.php"]');
      frontPageLinks.forEach(link => {
        const href = link.getAttribute('href');
        const match = href.match(/id=(\d+)/);
        if (match) {
          const id = match[1];
          const container = link.closest('.coursebox');
          const titleEl = container?.querySelector('h3, .coursename');
          const name = titleEl ? titleEl.textContent.trim() : link.textContent.trim();
          if (id !== '1' && !courseMap.has(id)) {
            courseMap.set(id, { id, name, url: href });
          }
        }
      });
    }

    const list = Array.from(courseMap.values());
    setCourses(list);
    return list;
  };

  const rewriteUrl = (url) => {
    if (!url) return '';
    if (url.includes('20.0.121.215')) {
      return url.replace('http://20.0.121.215', API_BASE)
        .replace('https://20.0.121.215', API_BASE);
    }
    return url;
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
        const classes = node.className;
        if (classes.includes('folder')) type = 'folder';
        else if (classes.includes('url')) type = 'url';
        else if (classes.includes('forum')) type = 'forum';
        else if (classes.includes('assign')) type = 'assignment';
        else if (classes.includes('resource')) type = 'file';
        else if (href.includes('folder')) type = 'folder';
        else if (href.includes('assign')) type = 'assignment';

        if (text.includes('Announcements') || text.includes('Attendance')) return null;

        return { id: href, name: text, url: href, type };
      }).filter(Boolean);

      if (mats.length === 0) {
        const resourceLinks = doc.querySelectorAll('a[href*="/mod/"]');
        const fallbackMats = Array.from(resourceLinks).map(link => {
          const href = rewriteUrl(link.href);
          if (href.includes('forum') || href.includes('label')) return null;

          let type = 'file';
          if (href.includes('folder')) type = 'folder';
          if (href.includes('assign')) type = 'assignment';
          if (href.includes('url')) type = 'url';

          return {
            id: href,
            name: link.textContent.trim(),
            url: href,
            type
          };
        }).filter(Boolean).filter(m => !m.name.includes('Announcements'));

        const unique = new Map();
        fallbackMats.forEach(m => unique.set(m.url, m));
        mats = Array.from(unique.values());
      }

      setMaterials(mats);
    } catch (error) {
      console.error("Fetch materials error", error);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrivateFiles = async () => {
    setLoading(true);
    setView('upload');
    setSelectedCourse(null);
    setPrivateFiles([]);
    setMobileMenuOpen(false);

    try {
      const res = await axios.get(`${API_BASE}/user/files.php`);
      const parser = new DOMParser();
      const doc = parser.parseFromString(res.data, 'text/html');

      const fileNodes = doc.querySelectorAll('.fp-filename-icon a, .fp-filename a');
      if (fileNodes.length > 0) {
        const files = Array.from(fileNodes).map(link => ({
          name: link.textContent.trim(),
          url: rewriteUrl(link.href),
          type: 'file'
        }));
        setPrivateFiles(files);
      } else {
        const downloadAll = doc.querySelector('form[action*="download_all"]');
        if (downloadAll) {
          setPrivateFiles([{ name: 'View & Manage Files in Moodle', url: `${API_BASE}/user/files.php`, type: 'folder' }]);
        }
      }
    } catch (e) {
      console.error("Fetch files error", e);
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

      let links = Array.from(regionMain.querySelectorAll('.fp-filename-icon a, .fp-filename a'));

      if (links.length === 0) {
        links = Array.from(regionMain.querySelectorAll('.activityinstance a'));
      }

      if (links.length === 0) {
        links = Array.from(regionMain.querySelectorAll('.generaltable a, .urlworkaround a'));
      }

      const folderMats = links.map(link => {
        const href = rewriteUrl(link.href);
        let name = link.textContent.trim();
        const fpName = link.querySelector('.fp-filename');
        const instName = link.querySelector('.instancename');
        if (fpName) name = fpName.textContent.trim();
        else if (instName) name = instName.childNodes[0].textContent.trim();

        let type = 'file';
        if (href.includes('/mod/folder/')) type = 'folder';
        else if (href.includes('/mod/assign/')) type = 'assignment';
        else if (href.includes('/mod/url/') && !href.includes('pluginfile')) type = 'url';
        else if (href.includes('/mod/forum/')) type = 'forum';

        if (!name || name.includes('Download folder')) return null;

        return { id: href, name: name, url: href, type: type };
      }).filter(Boolean);

      setMaterials(folderMats);
    } catch (err) {
      console.error("Folder open error", err);
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
        <p className="offline-text">
          We couldn't reach the learning portal. The server might be offline or your connection is unstable.
        </p>
        <button className="btn" onClick={() => { setIsOffline(false); setLoginError(null); }}>
          <RefreshCw size={20} /> Try Again
        </button>
      </div>
    );
  }

  // Checking Session State
  if (sessionChecking) {
    return (
      <div className="login-page-container">
        <div style={{ color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RefreshCw size={32} className="offline-icon" style={{ color: '#38bdf8' }} />
          <p>Restoring session...</p>
        </div>
      </div>
    );
  }

  // Centered Login Page
  if (!isLoggedIn) {
    return (
      <div className="login-page-container">
        <div className="login-card">
          <div className="login-logo">
            <GraduationCap size={48} />
            <h1 className="login-title">MITS Moodle Login</h1>
          </div>

          <form onSubmit={handleLogin} className="login-form" style={{ border: 'none', padding: 0, background: 'transparent', boxShadow: 'none' }}>
            {loginError && <div className="error-msg">{loginError}</div>}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter ID/Username"
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '40px' }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="rememberpass mt-3" style={{ display: 'none' }}>
            </div>

            <button type="submit" className="btn btn-block" style={{ marginTop: '1.5rem' }} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      ></div>

      {/* Sidebar */}
      <div className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GraduationCap size={28} />
            <span>MITS Moodle</span>
          </div>
          {/* Mobile Close Button */}
          <button
            className="mobile-nav-toggle"
            style={{ margin: 0, padding: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={24} color="#94a3b8" />
          </button>
        </div>

        <div className="course-scroll-area">
          <div className="section-title" style={{ marginTop: 0 }}>
            My Enrolled Courses
          </div>

          {loading && courses.length === 0 && <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1rem' }}>Loading...</div>}

          {courses.length === 0 && !loading && (
            <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '0.5rem' }}>No courses found.</div>
          )}

          <div className="course-list">
            {courses.map(course => (
              <div
                key={course.id}
                className={`sidebar-item ${selectedCourse?.id === course.id ? 'active' : ''}`}
                onClick={() => fetchMaterials(course)}
              >
                <Book size={18} />
                <span>{course.name}</span>
              </div>
            ))}
          </div>


        </div>

        {/* User Profile / Logout */}
        <div className="user-profile">
          <div className="user-info">
            {userData?.imageUrl && <img src={userData.imageUrl} alt="Profile" className="user-avatar" />}
            <span>{userData?.username}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={16} /> Log out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Mobile Header Toggle */}
        <div className="mobile-header-row">
          <button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
        </div>

        {view === 'upload' ? (
          <div className="content-pad">
            <h1 className="content-title">Private Files</h1>
            <p className="content-subtitle">Upload and manage your private files.</p>

            <div className="upload-section" style={{ marginTop: '2rem', border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '3rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <UploadCloud size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
              <h3 style={{ marginBottom: '0.5rem', color: '#475569' }}>Upload Files</h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Drag and drop files here, or click to upload</p>
              <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="file" style={{ display: 'none' }} />
                <span>Choose File (Simulated)</span>
              </label>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem' }}>* File upload logic requires complex Moodle API integration. This is a UI placeholder.</p>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Your Files</h3>
              {loading ? (
                <div>Loading files...</div>
              ) : privateFiles.length > 0 ? (
                <div className="resource-list">
                  {privateFiles.map((file, idx) => (
                    <div key={idx} className="resource-item">
                      <div className="resource-info">
                        <div className="card-icon"><File /></div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{file.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Private File</div>
                        </div>
                      </div>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn">
                        <Download size={16} /> Download
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>No accessible private files found via simple scrape.</div>
              )}
            </div>
          </div>
        ) : !selectedCourse ? (
          <div className="empty-state">
            <Layout size={64} className="empty-icon" />
            <h2>Select a course to view materials</h2>
          </div>
        ) : (
          <>
            <div className="content-header">
              {folderHistory.length > 0 && (
                <button onClick={handleBack} className="btn-outline" style={{ marginBottom: '0.5rem', paddingLeft: 0 }}>
                  <ArrowLeft size={18} /> Back
                </button>
              )}
              <h1 className="content-title">
                {folderHistory.length > 0 ? folderHistory[folderHistory.length - 1].name : selectedCourse.name}
              </h1>
              <p className="content-subtitle">
                {folderHistory.length > 0 ? 'Folder Contents' : 'Course Materials & Downloads'}
              </p>
            </div>

            {loading ? (
              <div style={{ color: '#94a3b8' }}>Loading materials...</div>
            ) : materials.length > 0 ? (
              <div className="resource-list">
                {materials.map((mat, idx) => (
                  <div key={idx} className="resource-item">
                    <div className="resource-info">
                      <div className="card-icon">
                        {mat.type === 'folder' ? <Folder /> :
                          mat.type === 'url' ? <Book /> :
                            mat.type === 'assignment' ? <FileText /> : <FileText />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{mat.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>{mat.type} Resource</div>
                      </div>
                    </div>
                    {/* Render different actions based on type */}
                    {mat.type === 'folder' ? (
                      <button onClick={() => handleFolderClick(mat)} className="btn">
                        <ChevronRight size={16} /> Open
                      </button>
                    ) : (
                      <a href={mat.url} target="_blank" rel="noopener noreferrer" className="btn">
                        {mat.type === 'url' ? <ChevronRight size={16} /> : <Download size={16} />}
                        {mat.type === 'url' ? 'Open' : 'Download'}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No materials found.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
