import urllib.request
from bs4 import BeautifulSoup
import time

html = urllib.request.urlopen('http://localhost:8000/').read().decode('utf-8')
print("HTML length:", len(html))
print("Select present?", 'global-theme-select' in html)
