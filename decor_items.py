from app import app, db, DecorItem

items = [
    {"name": "Кот", "type": "avatar", "price": 120, "image": "icons/cat.jfif"},
    {"name": "Робот", "type": "avatar", "price": 150, "image": "icons/robot.jfif"},
    {"name": "Дракон", "type": "avatar", "price": 120, "image": "icons/dragon.jfif"},
    {"name": "Горы", "type": "profile_bg", "price": 200, "image": "icons/mountains.jfif"},
    {"name": "Пиксель арт", "type": "profile_bg", "price": 250, "image": "icons/pixel art.jfif"},
    {"name": "Рассвет", "type": "cover_bg", "price": 300, "image": "icons/sun.jfif"},
    {"name": "Океан", "type": "cover_bg", "price": 350, "image": "icons/ocean.jfif"},
]

with app.app_context():
    for item in items:
        if not DecorItem.query.filter_by(name=item['name']).first():
            db.session.add(DecorItem(**item))
    db.session.commit()