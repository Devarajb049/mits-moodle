import streamlit as st
import requests
from bs4 import BeautifulSoup
import re
import time

# --- Configuration ---
MOODLE_BASE_URL = "http://20.0.121.215"

st.set_page_config(
    page_title="MITS Moodle",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS for Premium Styling ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    :root {
        --bg-color: #0f172a;
        --sidebar-bg: #1e293b;
        --text-primary: #f8fafc;
        --text-secondary: #94a3b8;
        --accent: #38bdf8;
        --accent-hover: #0ea5e9;
        --card-bg: #1e293b;
        --card-hover: #334155;
        --border: #334155;
        --error: #ef4444;
    }

    * {
        font-family: 'Inter', sans-serif !important;
    }

    /* Hide Streamlit components */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    [data-testid="stHeader"] {display: none;}

    .stApp {
        background-color: var(--bg-color);
        color: var(--text-primary);
    }

    /* Sidebar Styling */
    section[data-testid="stSidebar"] {
        background-color: var(--sidebar-bg) !important;
        border-right: 1px solid var(--border);
    }

    /* Sidebar Item Styling */
    .stButton > button {
        background-color: transparent;
        color: var(--text-secondary);
        border: none;
        border-radius: 8px;
        text-align: left;
        width: 100%;
        padding: 0.75rem 1rem;
        transition: all 0.2s;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }

    .stButton > button:hover {
        background-color: var(--card-hover) !important;
        color: var(--text-primary) !important;
    }

    .stButton > button:active, .stButton > button:focus {
        background-color: rgba(56, 189, 248, 0.1) !important;
        color: var(--accent) !important;
        border-left: 3px solid var(--accent) !important;
    }

    /* Login Card Styling */
    .login-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding-top: 5rem;
    }

    .login-card {
        background-color: var(--card-bg);
        padding: 2.5rem;
        border-radius: 1rem;
        border: 1px solid var(--border);
        width: 100%;
        max-width: 400px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }

    /* Resource Cards */
    .resource-card {
        background-color: var(--card-bg);
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        border: 1px solid var(--border);
        margin-bottom: 1rem;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .resource-card:hover {
        border-color: var(--accent);
        background-color: rgba(56, 189, 248, 0.05);
    }

    .icon-box {
        width: 42px;
        height: 42px;
        background-color: rgba(56, 189, 248, 0.1);
        border-radius: 0.75rem;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent);
        margin-right: 1.25rem;
    }

    /* Typography */
    h1, h2, h3 {
        color: var(--text-primary) !important;
        font-weight: 700 !important;
    }
    
    .caption {
        color: var(--text-secondary);
        font-size: 0.8rem;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
        width: 6px;
    }
    ::-webkit-scrollbar-track {
        background: transparent;
    }
    ::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 3px;
    }
</style>
""", unsafe_allow_html=True)

# --- Session Management ---
if 'session' not in st.session_state:
    st.session_state.session = requests.Session()
    st.session_state.session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })

if 'is_logged_in' not in st.session_state:
    st.session_state.is_logged_in = False

if 'view_state' not in st.session_state:
    st.session_state.view_state = 'dashboard'

if 'current_course' not in st.session_state:
    st.session_state.current_course = None

if 'folder_history' not in st.session_state:
    st.session_state.folder_history = []

if 'materials' not in st.session_state:
    st.session_state.materials = []

if 'user_data' not in st.session_state:
    st.session_state.user_data = {'name': 'Student', 'img': None}

if 'loading' not in st.session_state:
    st.session_state.loading = False

# --- Logic Functions ---

def login(username, password):
    try:
        # 1. Get Login Page for Token
        login_page = st.session_state.session.get(f"{MOODLE_BASE_URL}/login/index.php")
        soup = BeautifulSoup(login_page.text, 'html.parser')
        
        token_input = soup.find('input', {'name': 'logintoken'})
        login_token = token_input['value'] if token_input else ''

        # 2. Post Credentials
        payload = {
            'username': username,
            'password': password,
            'logintoken': login_token,
            'anchor': '',
            'rememberusername': '1'
        }
        
        response = st.session_state.session.post(
            f"{MOODLE_BASE_URL}/login/index.php", 
            data=payload
        )
        
        # 3. Check Success
        if "login/index.php" not in response.url and "loginerrormessage" not in response.text:
            st.session_state.is_logged_in = True
            fetch_user_profile()
            fetch_courses()
            return None
        else:
            soup_err = BeautifulSoup(response.text, 'html.parser')
            err_elem = soup_err.select_one('.loginerrors .error, .notifyproblem, .alert-danger')
            return err_elem.text.strip() if err_elem else "Login failed. Check your credentials."
            
    except Exception as e:
        return f"Error: {str(e)}"

def fetch_user_profile():
    try:
        res = st.session_state.session.get(f"{MOODLE_BASE_URL}/my/index.php")
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Name
        user_menu = soup.select_one('.usertext, .userbutton, .user-profile-name, .dropdown-toggle .userpicture')
        name = "Student"
        if user_menu:
             name = user_menu.get_text().strip()
             
        # Image
        img_elem = soup.select_one('.usermenu .userpicture, .userpicture')
        img_url = None
        if img_elem and img_elem.has_attr('src'):
            img_url = img_elem['src']
            
        st.session_state.user_data = {'name': name, 'img': img_url}
        
    except Exception:
        pass

def fetch_courses():
    try:
        res = st.session_state.session.get(f"{MOODLE_BASE_URL}/my/index.php")
        soup = BeautifulSoup(res.text, 'html.parser')
        courses = []
        seen_ids = set()

        items = soup.select('.dashboard-card, .course-summaryitem, .coursebox, .card')
        for item in items:
            anchor = item.select_one('a[href*="/course/view.php"]')
            if anchor:
                href = anchor['href']
                match = re.search(r'id=(\d+)', href)
                if match:
                    res_id = match.group(1)
                    if res_id != '1' and res_id not in seen_ids:
                        title_el = item.select_one('.coursename, .fullname, h3, h4, h5')
                        name = title_el.get_text().strip() if title_el else anchor.get_text().strip()
                        if name.lower() != 'course':
                            courses.append({'id': res_id, 'name': name})
                            seen_ids.add(res_id)
        
        if not courses:
             nav_links = soup.select('.block_navigation .type_course a[href*="/course/view.php"]')
             for link in nav_links:
                href = link['href']
                match = re.search(r'id=(\d+)', href)
                if match:
                    res_id = match.group(1)
                    if res_id != '1' and res_id not in seen_ids:
                        courses.append({'id': res_id, 'name': link.get_text().strip()})
                        seen_ids.add(res_id)
        
        st.session_state.courses = courses
    except Exception as e:
        st.error(f"Failed to fetch courses: {e}")

def parse_materials(soup):
    materials = []
    activities = soup.select('.activity')
    
    for node in activities:
        anchor = node.select_one('a')
        if not anchor: continue
        
        name_el = node.select_one('.instancename, .activityname')
        name = name_el.get_text().replace("File", "").replace("Folder", "").strip() if name_el else anchor.get_text().strip()
        
        href = anchor['href']
        m_type = 'file'
        classes = " ".join(node.get('class', []))
        if 'folder' in classes or 'folder' in href: m_type = 'folder'
        elif 'assign' in classes or 'assign' in href: m_type = 'assignment'
        elif 'url' in classes or 'url' in href: m_type = 'url'
        
        work_keywords = ['assignment', 'task', 'project', 'submission', 'homework', 'quiz', 'lab work']
        if any(kw in name.lower() for kw in work_keywords): m_type = 'assignment'
        
        if "Announcements" in name or "Attendance" in name: continue
        materials.append({'name': name, 'url': href, 'type': m_type})
        
    if not materials:
         links = soup.select('a[href*="/mod/"]')
         for link in links:
             href = link['href']
             if 'label' in href or 'forum' in href: continue
             
             m_type = 'file'
             if 'folder' in href: m_type = 'folder'
             elif 'assign' in href: m_type = 'assignment'
             elif 'url' in href: m_type = 'url'
             
             name = link.get_text().strip()
             work_keywords = ['assignment', 'task', 'project', 'submission', 'homework', 'quiz', 'lab work']
             if any(kw in name.lower() for kw in work_keywords): m_type = 'assignment'
             
             if "Announcements" in name: continue
             if not any(m['url'] == href for m in materials):
                  materials.append({'name': name, 'url': href, 'type': m_type})
    
    return materials

def fetch_course_materials(course_id, course_name):
    st.session_state.current_course = {'id': course_id, 'name': course_name}
    st.session_state.folder_history = []
    
    try:
        res = st.session_state.session.get(f"{MOODLE_BASE_URL}/course/view.php?id={course_id}")
        soup = BeautifulSoup(res.text, 'html.parser')
        mats = parse_materials(soup)
        st.session_state.materials = mats
        st.session_state.view_state = 'course'
    except Exception as e:
        st.error(f"Error: {e}")

def open_folder(folder_url, folder_name):
    try:
         st.session_state.folder_history.append({
             'name': st.session_state.materials_title if 'materials_title' in st.session_state else st.session_state.current_course['name'],
             'materials': st.session_state.materials
         })
         
         res = st.session_state.session.get(folder_url)
         soup = BeautifulSoup(res.text, 'html.parser')
         
         main_region = soup.select_one('[role="main"], .region-main') or soup.body
         links = main_region.select('.fp-filename-icon a, .fp-filename a')
         if not links:
             links = main_region.select('.activityinstance a')
             
         mats = []
         for link in links:
             href = link['href']
             name = link.get_text().strip()
             if not name or "Download folder" in name: continue
             m_type = 'file'
             if 'folder' in href: m_type = 'folder'
             mats.append({'name': name, 'url': href, 'type': m_type})
             
         st.session_state.materials = mats
         st.session_state.materials_title = folder_name
    except Exception as e:
        st.error(f"Failed to open folder: {e}")

def go_back():
    if st.session_state.folder_history:
        prev = st.session_state.folder_history.pop()
        st.session_state.materials = prev['materials']
        st.session_state.materials_title = prev['name']

def download_file(url):
    try:
        r = st.session_state.session.get(url, stream=True)
        return r.content
    except Exception:
        return None

# --- UI Helpers ---

def get_icon(mat_type):
    if mat_type == 'folder': return "📂"
    if mat_type == 'assignment': return "📝"
    if mat_type == 'url': return "🔗"
    return "📄"

# --- UI Rendering ---

def render_login():
    st.markdown("<div class='login-container'>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("""
        <div class='login-card'>
            <div style='text-align:center; margin-bottom: 2rem;'>
                <div style='color: #38bdf8; font-size: 48px; margin-bottom: 0.5rem;'>🎓</div>
                <h1 style='margin:0; font-size: 24px;'>MITS Moodle Login</h1>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        with st.container():
            # Use columns to mimic the card feel since st.form adds its own styling
            with st.form("login_form"):
                user = st.text_input("Username", placeholder="Enter ID")
                pw = st.text_input("Password", type="password", placeholder="Enter Password")
                submitted = st.form_submit_button("Log In", use_container_width=True)
                
                if submitted:
                    if not user or not pw:
                        st.warning("Please enter credentials")
                    else:
                        st.session_state.loading = True
                        err = login(user, pw)
                        st.session_state.loading = False
                        if err:
                            st.error(err)
                        else:
                            st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)

def render_sidebar():
    with st.sidebar:
        st.markdown("""
        <div style='display: flex; align-items: center; gap: 0.5rem; margin-bottom: 2rem;'>
            <div style='color: #38bdf8; font-size: 28px;'>🎓</div>
            <span style='font-size: 1.5rem; font-weight: 700; color: #38bdf8;'>MITS Moodle</span>
        </div>
        """, unsafe_allow_html=True)
        
        # User Profile Mini
        if st.session_state.user_data.get('img'):
             st.image(st.session_state.user_data['img'], width=50)
        st.markdown(f"<div style='margin-bottom: 0.5rem;'><strong>{st.session_state.user_data.get('name')}</strong></div>", unsafe_allow_html=True)
        
        if st.button("Log Out", key="logout_btn"):
            st.session_state.session.get(f"{MOODLE_BASE_URL}/login/logout.php")
            st.session_state.clear()
            st.rerun()

        st.markdown("<div style='margin-top: 1.5rem; color: #94a3b8; font-size: 0.75rem; text-transform: uppercase;'>My Enrolled Courses</div>", unsafe_allow_html=True)
        
        if 'courses' in st.session_state:
            for course in st.session_state.courses:
                # Use a unique key and wrap in a container for easier targeting
                if st.button(f"📖 {course['name']}", key=f"c_{course['id']}"):
                    fetch_course_materials(course['id'], course['name'])
                    st.rerun()

def render_main():
    # Top Nav Bar (Profile Icon)
    t1, t2 = st.columns([10, 1])
    with t2:
        if st.session_state.user_data.get('img'):
            st.markdown(f"""
            <div style='border: 2px solid #38bdf8; border-radius: 50%; overflow: hidden; width: 45px; height: 45px; cursor: pointer;'>
                <img src='{st.session_state.user_data['img']}' style='width: 100%; height: 100%; object-fit: cover;'>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown("<div style='color: #38bdf8; font-size: 32px;'>👤</div>", unsafe_allow_html=True)

    if st.session_state.view_state == 'dashboard':
        st.markdown("<div style='margin-top: 2rem;'>", unsafe_allow_html=True)
        st.title("User Dashboard")
        st.info("Select a course from the sidebar to view materials.")
        st.markdown("</div>", unsafe_allow_html=True)
        
    elif st.session_state.view_state == 'course':
        st.markdown("<div style='margin-top: 1rem;'>", unsafe_allow_html=True)
        
        header_col, back_col = st.columns([8, 2])
        with header_col:
            title = st.session_state.materials_title if 'materials_title' in st.session_state else st.session_state.current_course['name']
            st.header(title)
        
        with back_col:
            if st.session_state.folder_history:
                if st.button("⬅️ Back"):
                    go_back()
                    st.rerun()

        st.markdown("<hr style='border-color: #334155; margin-bottom: 2rem;'>", unsafe_allow_html=True)
        
        if not st.session_state.materials:
            st.warning("No materials found.")
        else:
            for idx, mat in enumerate(st.session_state.materials):
                # Using columns to create the card look with an action button
                with st.container():
                    # Manual HTML Card start
                    icon = get_icon(mat['type'])
                    
                    c1, c2, c3 = st.columns([1, 6, 2])
                    with c1:
                        st.markdown(f"<div class='icon-box'>{icon}</div>", unsafe_allow_html=True)
                    with c2:
                        st.markdown(f"**{mat['name']}**")
                        st.markdown(f"<div class='caption'>{mat['type'].capitalize()} Resource</div>", unsafe_allow_html=True)
                    with c3:
                        if mat['type'] == 'folder':
                            if st.button("Open", key=f"open_{idx}", use_container_width=True):
                                open_folder(mat['url'], mat['name'])
                                st.rerun()
                        elif mat['type'] == 'url':
                            st.markdown(f"<a href='{mat['url']}' target='_blank' class='btn' style='width:100%; text-decoration:none;'>Open</a>", unsafe_allow_html=True)
                        else:
                            # Streamlit Download Button
                            file_data = download_file(mat['url'])
                            if file_data:
                                label = "Upload" if mat['type'] == 'assignment' else "Download"
                                st.download_button(
                                    label=label,
                                    data=file_data,
                                    file_name=mat['name'],
                                    key=f"dl_{idx}",
                                    use_container_width=True
                                )
                            else:
                                st.error("Link Expired")
                st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)

def main():
    if not st.session_state.is_logged_in:
        render_login()
    else:
        render_sidebar()
        render_main()

if __name__ == "__main__":
    main()
