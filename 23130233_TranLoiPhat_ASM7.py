"""
ASM7 - Automation script - Group09 - 23130233 - Tran Loi Phat
Website : https://opensource-demo.orangehrmlive.com  (OrangeHRM OS 5.9)
Module  : Claim  -  Function: Events (Claim > Configuration > Events)
Tool    : Selenium WebDriver + Python + pytest
Test cases: [Claim-Events-1] ... [Claim-Events-23]  (same IDs as the Excel test case file)

Run:
    pip install selenium pytest pytest-html
    set HRM_USER / HRM_PASS (demo account shown on the OrangeHRM login page)
    pytest 23130233_TranLoiPhat_ASM7.py -v --html=report.html --self-contained-html

Optional:
    DEMO_DELAY=1   -> pause 1 second after each action (easier to follow in the video)
    HRM_HEADLESS=1 -> run without showing the browser
"""
import os
import time

import pytest
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# ============================== CONFIG ==============================
BASE_URL = "https://opensource-demo.orangehrmlive.com/web/index.php/"
USERNAME = os.getenv("HRM_USER", "")
PASSWORD = os.getenv("HRM_PASS", "")
DEMO_DELAY = float(os.getenv("DEMO_DELAY", "0"))
HEADLESS = os.getenv("HRM_HEADLESS", "0") == "1"
TIMEOUT = 15

LIST_PATH = "claim/viewEvents"
ADD_PATH = "claim/saveEvents"
CREATED = set()          # events created by this script -> deleted at the end


def unique(prefix):
    """Name that never repeats between runs, e.g. 'G09 Travel 4823917'."""
    return f"{prefix} {int(time.time() * 1000) % 10_000_000}"


def group(label):
    """XPath of the OXD input group whose label is `label` (ignores the * mark)."""
    return ("//div[contains(@class,'oxd-input-group')]"
            f"[.//label[normalize-space(translate(., '*', ''))='{label}']]")


# ============================== PAGE OBJECT ==============================
class EventsPage:
    def __init__(self, driver):
        self.d = driver
        self.wait = WebDriverWait(driver, TIMEOUT, poll_frequency=0.2)

    # ---------- basic helpers ----------
    def pause(self):
        if DEMO_DELAY:
            time.sleep(DEMO_DELAY)

    def open(self, path):
        self.d.get(BASE_URL + path)
        self.wait_ready()
        self.pause()

    def wait_ready(self):
        self.wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
        loader = (By.CSS_SELECTOR, ".oxd-form-loader, .oxd-loading-spinner")
        try:
            WebDriverWait(self.d, 1).until(EC.presence_of_element_located(loader))
        except TimeoutException:
            pass
        self.wait.until(EC.invisibility_of_element_located(loader))

    def field(self, label):
        return self.wait.until(EC.visibility_of_element_located(
            (By.XPATH, group(label) + "//*[self::input or self::textarea]")))

    def type(self, label, text):
        el = self.field(label)
        el.send_keys(Keys.CONTROL, "a")
        el.send_keys(Keys.DELETE)
        if text:
            el.send_keys(text)
        self.pause()

    def click_button(self, text, scope=""):
        self.wait.until(EC.element_to_be_clickable(
            (By.XPATH, f"{scope}//button[normalize-space()='{text}']"))).click()
        self.pause()

    def has_button(self, text):
        return len(self.d.find_elements(By.XPATH, f"//button[normalize-space()='{text}']")) > 0

    def error(self, label, expect=None, timeout=5.0):
        """Error message under a field.
        The duplicate-name check is asynchronous: right after the field is cleared the page shows
        'Required' first, then 'Already exists' 1-2 seconds later. So when `expect` is given we keep
        waiting until that message appears (or timeout) and return the last message seen."""
        xp = group(label) + "//span[contains(@class,'oxd-input-field-error-message')]"
        end = time.time() + timeout
        last = ""
        while time.time() < end:
            els = self.d.find_elements(By.XPATH, xp)
            last = els[0].text.strip() if els else ""
            if (expect is None and last) or (expect is not None and last == expect):
                return last
            time.sleep(0.3)
        return last

    def no_error(self, label, wait=2.5):
        time.sleep(wait)
        return self.error(label, timeout=0.5) == ""

    def toast(self):
        el = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".oxd-toast")))
        return " ".join(el.text.split())

    def select(self, label, option):
        self.wait.until(EC.element_to_be_clickable(
            (By.XPATH, group(label) + "//div[contains(@class,'oxd-select-text')]"))).click()
        self.wait.until(EC.element_to_be_clickable(
            (By.XPATH, f"//div[@role='option'][normalize-space()='{option}']"))).click()
        self.pause()

    def selected(self, label):
        return self.d.find_element(
            By.XPATH, group(label) + "//div[contains(@class,'oxd-select-text-input')]").text.strip()

    def autocomplete(self, text, pick=None):
        """Type into Event Name filter, return the hint list, optionally pick one hint."""
        self.type("Event Name", text)
        time.sleep(2)
        # when nothing matches, the dropdown shows a 'No Records Found' line -> not a real hint
        hints = [o.text.strip() for o in self.d.find_elements(By.CSS_SELECTOR, ".oxd-autocomplete-option")
                 if o.text.strip() not in ("No Records Found", "Searching....")]
        if pick:
            self.wait.until(EC.element_to_be_clickable(
                (By.XPATH, f"//div[contains(@class,'oxd-autocomplete-option')][normalize-space()='{pick}']"))).click()
            self.pause()
        return hints

    # ---------- table ----------
    def records_text(self):
        self.wait_ready()
        return self.wait.until(EC.visibility_of_element_located(
            (By.XPATH, "//span[contains(.,'Record')]"))).text.strip()

    def rows(self):
        self.wait_ready()
        return [" | ".join(r.text.split("\n")) for r in self.d.find_elements(By.CSS_SELECTOR, ".oxd-table-card")]

    def names(self):
        return [r.split(" | ")[0] for r in self.rows()]

    def row(self, name):
        return self.wait.until(EC.presence_of_element_located(
            (By.XPATH, f"//div[contains(@class,'oxd-table-card')][.//div[normalize-space()='{name}']]")))

    def row_action(self, name, icon):
        """icon: 'bi-trash' (delete) or 'bi-pencil-fill' (edit)."""
        self.row(name).find_element(By.CSS_SELECTOR, f"i.{icon}").find_element(By.XPATH, "./..").click()
        self.wait_ready()
        self.pause()

    def confirm_dialog(self, yes=True):
        dlg = self.wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, ".oxd-dialog-sheet")))
        text = " ".join(dlg.text.split())
        self.pause()
        self.click_button("Yes, Delete" if yes else "No, Cancel", "//div[contains(@class,'oxd-dialog-sheet')]")
        return text

    def sort(self, column, direction):
        hdr = self.d.find_element(
            By.XPATH, f"//div[contains(@class,'oxd-table-header-cell')][contains(normalize-space(),'{column}')]")
        hdr.find_element(By.CSS_SELECTOR, ".oxd-table-header-sort-icon").click()
        self.pause()
        hdr.find_element(By.XPATH, f".//span[normalize-space()='{direction}']").click()
        self.wait_ready()
        self.pause()

    # ---------- Events actions ----------
    def open_list(self):
        self.open(LIST_PATH)

    def open_add(self):
        self.open(ADD_PATH)

    def fill(self, name=None, description=None, active=None):
        if name is not None:
            self.type("Event Name", name)
        if description is not None:
            self.type("Description", description)
        if active is not None:
            box = self.d.find_element(By.CSS_SELECTOR, "form input[type='checkbox']")
            if box.is_selected() != active:
                self.d.find_element(By.CSS_SELECTOR, "form .oxd-switch-input").click()
                self.pause()

    def save(self):
        self.click_button("Save")

    def create(self, name, description="", active=True):
        """Add an event through the UI and return the toast message."""
        self.open_add()
        self.fill(name, description, active)
        self.no_error("Event Name", wait=2)
        self.save()
        msg = self.toast()
        self.wait.until(EC.url_contains(LIST_PATH))
        self.wait_ready()
        CREATED.add(name)
        return msg

    def search(self, name=None, status=None):
        if name:
            self.autocomplete(name, pick=name)
        if status:
            self.select("Status", status)
        self.click_button("Search")
        self.wait_ready()

    def delete_by_api(self, names):
        """Clean up: delete events by name with the app's own REST API (current session)."""
        return self.d.execute_async_script("""
            const [names, done] = arguments;
            fetch('/web/index.php/api/v2/claim/events?limit=200&offset=0').then(r => r.json())
              .then(res => {
                const ids = (res.data || []).filter(e => names.includes(e.name)).map(e => e.id);
                if (!ids.length) return done('nothing to delete');
                return fetch('/web/index.php/api/v2/claim/events', {method: 'DELETE',
                    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ids})})
                  .then(() => done('deleted ' + ids.length));
              }).catch(e => done(String(e)));
        """, list(names))


# ============================== FIXTURES ==============================
@pytest.fixture(scope="session")
def driver():
    if not (USERNAME and PASSWORD):
        pytest.exit("Please set HRM_USER and HRM_PASS (demo account shown on the OrangeHRM login page).")
    opts = Options()
    if HEADLESS:
        opts.add_argument("--headless=new")
    drv = webdriver.Chrome(options=opts)
    drv.set_window_size(1440, 900)
    login(drv)
    yield drv
    try:
        print("\nCleanup:", EventsPage(drv).delete_by_api(CREATED))
    except Exception:
        pass
    drv.quit()


def login(drv):
    drv.get(BASE_URL + "auth/login")
    w = WebDriverWait(drv, TIMEOUT)
    w.until(EC.visibility_of_element_located((By.NAME, "username"))).send_keys(USERNAME)
    drv.find_element(By.NAME, "password").send_keys(PASSWORD)
    drv.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    w.until(EC.url_contains("dashboard"))


@pytest.fixture(autouse=True)
def relogin_if_needed(driver):
    """The demo site sometimes expires the session: log in again when sent to the login page."""
    if "auth/login" in driver.current_url:
        login(driver)
    yield


@pytest.fixture
def page(driver):
    return EventsPage(driver)


@pytest.fixture(scope="session")
def ev(driver):
    """Shared data: 1 active event and 1 inactive event."""
    p = EventsPage(driver)
    data = {"active": unique("G09 Travel"), "inactive": unique("G09 Inactive")}
    p.create(data["active"], "Business trip expenses - Group09 test")
    p.create(data["inactive"], "Inactive event - Group09 test", active=False)
    return data


# ============================== TEST CASES ==============================
def test_claim_events_01_list_ui(page):
    """[Claim-Events-1] Check UI of Events list screen"""
    page.open_list()
    assert "Records Found" in page.records_text()
    assert page.field("Event Name").get_attribute("placeholder") == "Type for hints..."
    assert page.selected("Status") == "-- Select --"
    for b in ("Reset", "Search", "Add"):
        assert page.has_button(b), f"Missing button {b}"
    assert {"Accommodation", "Medical Reimbursement", "Travel Allowance"} <= set(page.names())


def test_claim_events_02_add_valid(page):
    """[Claim-Events-2] Add a valid event"""
    name = unique("G09 Add")
    assert "Successfully Saved" in page.create(name, "Business trip expenses - Group09 test")
    assert any(r.startswith(name) and r.endswith("Active") for r in page.rows())


def test_claim_events_03_name_empty(page):
    """[Claim-Events-3] Event Name is empty"""
    page.open_add()
    page.save()
    assert page.error("Event Name", "Required") == "Required"
    assert ADD_PATH in page.d.current_url


def test_claim_events_04_name_spaces(page):
    """[Claim-Events-4] Event Name contains only spaces"""
    page.open_add()
    page.fill("   ")
    page.save()
    assert page.error("Event Name", "Required") == "Required"


def test_claim_events_05_name_100_chars(page):
    """[Claim-Events-5] Event Name with 100 characters (upper boundary)"""
    name = unique("G09").ljust(100, "L")
    assert len(name) == 100
    assert "Successfully Saved" in page.create(name)


def test_claim_events_06_name_101_chars(page):
    """[Claim-Events-6] Event Name with 101 characters (over boundary)"""
    page.open_add()
    page.fill("G" * 101)
    assert page.error("Event Name", "Should not exceed 100 characters") == "Should not exceed 100 characters"


def test_claim_events_07_name_duplicate(page):
    """[Claim-Events-7] Event Name duplicates an existing event"""
    page.open_add()
    page.fill("Accommodation")
    assert page.error("Event Name", "Already exists") == "Already exists"


def test_claim_events_08_name_duplicate_case(page):
    """[Claim-Events-8] Event Name duplicates with different letter case"""
    page.open_add()
    page.fill("accommodation")
    assert page.error("Event Name", "Already exists") == "Already exists"


def test_claim_events_09_name_duplicate_spaces(page, ev):
    """[Claim-Events-9] Duplicate name with leading/trailing spaces -> expected 'Already exists'.
    Known defect BUG-01: the site shows toast 'Invalid Parameter' instead, so this test FAILS."""
    page.open_add()
    page.fill(f"  {ev['active']}  ")
    assert page.error("Event Name", "Already exists") == "Already exists"


def test_claim_events_10_description_length(page):
    """[Claim-Events-10] Description with 1000 / 1001 characters"""
    page.open_add()
    page.fill("G09 Desc Test", "D" * 1000)
    assert page.no_error("Description", wait=1)
    page.fill(description="D" * 1001)
    assert page.error("Description", "Should not exceed 1000 characters") == "Should not exceed 1000 characters"


def test_claim_events_11_add_inactive(page, ev):
    """[Claim-Events-11] Add an inactive event"""
    page.open_list()
    assert any(r.startswith(ev["inactive"]) and r.endswith("Inactive") for r in page.rows())


def test_claim_events_12_cancel_add(page):
    """[Claim-Events-12] Cancel button on Add Event screen"""
    name = unique("G09 Cancel")
    page.open_add()
    page.fill(name)
    page.click_button("Cancel")
    page.wait.until(EC.url_contains(LIST_PATH))
    assert name not in page.names()


def test_claim_events_13_search_by_name(page, ev):
    """[Claim-Events-13] Search by Event Name (select from hints)"""
    page.open_list()
    assert ev["active"] in page.autocomplete("G09 Travel")
    page.search(name=ev["active"])
    assert page.records_text() == "(1) Records Found"
    assert page.names() == [ev["active"]]


def test_claim_events_14_search_not_found(page):
    """[Claim-Events-14] Search with a non-existent name"""
    page.open_list()
    assert page.autocomplete("G09 Khong Ton Tai") == []      # no real hint
    assert "No Records Found" in [o.text.strip() for o in page.d.find_elements(By.CSS_SELECTOR, ".oxd-autocomplete-option")]
    page.click_button("Search")
    assert "No Records Found" in page.toast()
    assert page.rows() == []


def test_claim_events_15_filter_inactive(page, ev):
    """[Claim-Events-15] Filter by Status = Inactive"""
    page.open_list()
    page.search(status="Inactive")
    rows = page.rows()
    assert rows and all(r.endswith("Inactive") for r in rows)
    assert ev["inactive"] in page.names()


def test_claim_events_16_reset_filter(page, ev):
    """[Claim-Events-16] Reset button of the filter"""
    page.open_list()
    total = page.records_text()
    page.search(name=ev["active"])
    page.click_button("Reset")
    page.wait_ready()
    assert page.field("Event Name").get_attribute("value") == ""
    assert page.selected("Status") == "-- Select --"
    assert page.records_text() == total


def test_claim_events_17_sort_descending(page):
    """[Claim-Events-17] Sort by Event Name descending"""
    page.open_list()
    page.sort("Event Name", "Descending")
    names = page.names()
    assert names == sorted(names, key=str.lower, reverse=True)


def test_claim_events_18_edit_validation(page, ev):
    """[Claim-Events-18] Edit event - name validation"""
    page.open_list()
    page.row_action(ev["active"], "bi-pencil-fill")
    assert page.field("Event Name").get_attribute("value") == ev["active"]
    page.fill("Medical Reimbursement")
    assert page.error("Event Name", "Already exists") == "Already exists"
    page.fill("")
    assert page.error("Event Name", "Required") == "Required"


def test_claim_events_19_edit_valid(page, ev):
    """[Claim-Events-19] Edit event name and description"""
    new = unique("G09 Business Trip")
    page.open_list()
    page.row_action(ev["active"], "bi-pencil-fill")
    page.fill(new, "Updated by Group09")
    page.no_error("Event Name", wait=2)
    page.save()
    assert "Successfully Updated" in page.toast()
    CREATED.add(new)
    ev["active"] = new
    page.wait.until(EC.url_contains(LIST_PATH))
    assert new in page.names()


def test_claim_events_20_edit_to_inactive(page):
    """[Claim-Events-20] Edit event from Active to Inactive"""
    name = unique("G09 Toggle")
    page.create(name)
    page.row_action(name, "bi-pencil-fill")
    page.fill(active=False)
    page.save()
    assert "Successfully Updated" in page.toast()
    page.wait.until(EC.url_contains(LIST_PATH))
    assert any(r.startswith(name) and r.endswith("Inactive") for r in page.rows())


def test_claim_events_21_delete_cancel(page, ev):
    """[Claim-Events-21] Delete event - select No, Cancel"""
    page.open_list()
    page.row_action(ev["inactive"], "bi-trash")
    text = page.confirm_dialog(yes=False)
    assert "Are you Sure?" in text and "permanently deleted" in text
    assert ev["inactive"] in page.names()


def test_claim_events_22_delete_yes(page):
    """[Claim-Events-22] Delete event - select Yes, Delete"""
    name = unique("G09 Delete")
    page.create(name)
    page.row_action(name, "bi-trash")
    page.confirm_dialog(yes=True)
    assert "Successfully Deleted" in page.toast()
    assert name not in page.names()


def test_claim_events_23_bulk_delete(page):
    """[Claim-Events-23] Delete multiple events at once"""
    names = [unique("G09 Bulk A"), unique("G09 Bulk B")]
    for n in names:
        page.create(n)
    for n in names:
        page.row(n).find_element(By.CSS_SELECTOR, ".oxd-checkbox-input").click()
        page.pause()
    assert "(2) Records Selected" in page.d.page_source
    page.click_button("Delete Selected")
    page.confirm_dialog(yes=True)
    assert "Successfully Deleted" in page.toast()
    current = page.names()
    assert all(n not in current for n in names)
