import streamlit as st
import requests
from bs4 import BeautifulSoup
import re

# --- Configuration ---
MOODLE_BASE_URL = "http://20.0.121.215"

st.set_page_config(
    page_title="MITS Moodle",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Custom CSS for Styling ---
st.markdown("""
<style>
    /* Dark Mode Theme Adjustment */
    .stApp {
        background-color: #0f172a;
        color: #f8fafc;
    }
    
    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #1e293b;
    }
    
    /* Buttons */
    .stButton button {
        background-color: #38bdf8;
        color: white;
        border: none;
        border-radius: 8px;
        transition: all 0.2s;
        width: 100%;
    }
    .stButton button:hover {
        background-color: #0ea5e9;
        border-color: #0ea5e9;
        color: white;
    }
    
    /* Cards/Containers */
    .css-1r6slb0, .css-keje6w {
        background-color: #1e293b;
        border: 1px solid #334155;
        padding: 20px;
        border-radius: 10px;
    }
    
    /* Headers */
    h1, h2, h3 {
        color: #f8fafc !important;
    }
    p, span, div {
        color: #94a3b8;
    }
    strong {
        color: #f8fafc;
    }
    
    /* Remove default Streamlit decoration */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    
    /* Scrollbars */
    ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    ::-webkit-scrollbar-thumb {
        background: #334155; 
        border-radius: 4px;
    }
    ::-webkit-scrollbar-track {
        background: transparent; 
    }
</style>
""", unsafe_allow_html=True)

# --- Session Management ---
if 'session' not in st.session_state:
    st.session_state.session = requests.Session()
    # Mock user agent to look like a browser
    st.session_state.session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    })

if 'is_logged_in' not in st.session_state:
    st.session_state.is_logged_in = False

if 'view_state' not in st.session_state:
    st.session_state.view_state = 'dashboard' # dashboard, course, folder

if 'current_course' not in st.session_state:
    st.session_state.current_course = None

if 'folder_history' not in st.session_state:
    st.session_state.folder_history = []

if 'materials' not in st.session_state:
    st.session_state.materials = []

if 'user_data' not in st.session_state:
    st.session_state.user_data = {'name': 'Student', 'img': None}


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
            st.rerun()
        else:
            soup_err = BeautifulSoup(response.text, 'html.parser')
            err_elem = soup_err.select_one('.loginerrors .error, .notifyproblem, .alert-danger')
            return err_elem.text.strip() if err_elem else "Login failed"
            
    except Exception as e:
        return "Error occurred, try again. If not reached, the server might be unreachable."

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

        # Strategy 1: Dashboard Cards
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
        
        # Strategy 2: Nav Links
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

def get_icon(mat_type):
    if mat_type == 'folder': return "📂"
    if mat_type == 'pdf': return "📄"
    if mat_type == 'url': return "🔗"
    if mat_type == 'assignment': return "📝"
    return "box"

def parse_materials(soup):
    materials = []
    
    # Generic activity finder
    activities = soup.select('.activity')
    
    for node in activities:
        anchor = node.select_one('a')
        if not anchor: continue
        
        name_el = node.select_one('.instancename, .activityname')
        name = name_el.get_text().replace("File", "").replace("Folder", "").strip() if name_el else anchor.get_text().strip()
        
        href = anchor['href']
        
        # Determine Type
        m_type = 'file'
        classes = " ".join(node.get('class', []))
        if 'folder' in classes or 'folder' in href: m_type = 'folder'
        elif 'assign' in classes or 'assign' in href: m_type = 'assignment'
        elif 'url' in classes or 'url' in href: m_type = 'url'
        elif 'forum' in classes: m_type = 'forum'
        
        if "Announcements" in name or "Attendance" in name: continue
        
        materials.append({'name': name, 'url': href, 'type': m_type})
        
    # Fallback
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
         # Push current view to history
         st.session_state.folder_history.append({
             'name': st.session_state.current_course['name'] if not st.session_state.folder_history else st.session_state.folder_history[-1]['name'],
             'materials': st.session_state.materials
         })
         
         res = st.session_state.session.get(folder_url)
         soup = BeautifulSoup(res.text, 'html.parser')
         
         # Folder specific parsing logic
         main_region = soup.select_one('[role="main"], .region-main') or soup.body
         links = main_region.select('.fp-filename-icon a, .fp-filename a')
         if not links:
             links = main_region.select('.activityinstance a')
             
         mats = []
         for link in links:
             href = link['href']
             name = link.get_text().strip()
             
             m_type = 'file'
             if 'folder' in href: m_type = 'folder'
             
             mats.append({'name': name, 'url': href, 'type': m_type})
             
         st.session_state.materials = mats
         # Update "current view name" purely for UI
         # We cheat a bit here by not updating current_course name to folder name to keep context, 
         # but using a separate display state
    except Exception as e:
        st.error(f"Failed to open folder: {e}")

def go_back():
    if st.session_state.folder_history:
        prev = st.session_state.folder_history.pop()
        st.session_state.materials = prev['materials']

def download_file(url, filename):
    # Proxy download: Server fetches, then gives to user
    try:
        r = st.session_state.session.get(url, stream=True)
        return r.content
    except Exception as e:
        return None

# --- UI Rendering ---

def render_login():
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        st.markdown("<h2 style='text-align: center;'>🎓 MITS Moodle Login</h2>", unsafe_allow_html=True)
        with st.form("login_form"):
            user = st.text_input("Username")
            pw = st.text_input("Password", type="password")
            submitted = st.form_submit_button("Log In")
            
            if submitted:
                if not user or not pw:
                    st.warning("Please enter credentials")
                else:
                    err = login(user, pw)
                    if err:
                        st.error(err)

def render_sidebar():
    with st.sidebar:
        st.markdown("### 🎓 MITS Moodle")
        
        if st.session_state.user_data.get('img'):
             st.image(st.session_state.user_data['img'], width=60)
        st.write(f"**{st.session_state.user_data.get('name')}**")
        
        if st.button("Log Out"):
            st.session_state.session.get(f"{MOODLE_BASE_URL}/login/logout.php")
            st.session_state.clear()
            st.rerun()

        st.markdown("---")
        st.markdown("### My Courses")
        
        if 'courses' in st.session_state:
            for course in st.session_state.courses:
                if st.button(course['name'], key=f"c_{course['id']}"):
                    fetch_course_materials(course['id'], course['name'])
                    st.rerun()

def render_main():
    if st.session_state.view_state == 'dashboard':
        st.title("User Dashboard")
        st.info("Select a course from the sidebar to view materials.")
        
    elif st.session_state.view_state == 'course':
        # Header
        col_back, col_title = st.columns([1, 5])
        with col_back:
            if st.session_state.folder_history:
                if st.button("⬅️ Back"):
                    go_back()
                    st.rerun()
        with col_title:
             current_name = st.session_state.current_course['name']
             if st.session_state.folder_history:
                 st.markdown(f"### 📂 Folder View")
             else:
                 st.markdown(f"## {current_name}")

        st.markdown("---")
        
        if not st.session_state.materials:
            st.warning("No materials found.")
            
        for idx, mat in enumerate(st.session_state.materials):
            # Card Layout
            with st.container():
                c1, c2 = st.columns([4, 1])
                with c1:
                    icon = get_icon(mat.get('type'))
                    st.markdown(f"### {icon} {mat['name']}")
                    st.caption(f"Type: {mat.get('type')}")
                
                with c2:
                    if mat.get('type') == 'folder':
                        if st.button("Open", key=f"open_{idx}"):
                            open_folder(mat['url'], mat['name'])
                            st.rerun()
                    elif mat.get('type') in ['file', 'pdf', 'assignment']:
                         # Secure Download via Streamlit Proxy
                         file_data = download_file(mat['url'], mat['name'])
                         if file_data:
                             st.download_button(
                                 label="Download",
                                 data=file_data,
                                 file_name=f"{mat['name']}.{mat.get('type', 'file')}", # Guessed ext
                                 key=f"dl_{idx}"
                             )
                         else:
                             st.error("Failed to fetch")
                    elif mat.get('type') == 'url':
                        st.markdown(f"[Open Link]({mat['url']})")
                
                st.markdown("---")

def main():
    if not st.session_state.is_logged_in:
        render_login()
    else:
        render_sidebar()
        render_main()

if __name__ == "__main__":
    main()
