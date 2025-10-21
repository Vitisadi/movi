import requests
from ..entries.schemas import Book
import datetime

def get_book_from_api(title):
    title = "+".join(title.lower().split(" "))
    url = f"https://openlibrary.org/search.json?title={title}"
    result = None
    try:
        response = requests.get(url=url)

        if response.status_code == 200:
            posts = response.json()
            if not posts["docs"]:
                return "Book not found"
            results = posts["docs"]
        else:
            print('Error:', response.status_code)
            return None
            
        result = results[0] if "+".join(results[0].get("title").lower().split(" ")) == title.lower() else results[1]
    except Exception as e:
        print(e)

    
    return Book(title=result.get("title"),
                year_released=result.get("first_publish_year"),
                date_added=datetime.datetime.now(),
                avg_rating=None,
                added_by=None,
                wishlisted_by=None,
                author=result.get("author_name")[0],
                publisher=None,
                page_count=None)