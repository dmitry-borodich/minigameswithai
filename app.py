from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
import re
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc, asc
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
from flask_migrate import Migrate
from check_swear import SwearingCheck
import os

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = 'leepteen@gmail.com'

mail = Mail(app)

s = URLSafeTimedSerializer(app.secret_key)

sch = SwearingCheck()

def generate_confirmation_token(email):
    return s.dumps(email, salt='email-confirm')


def confirm_token(token, expiration=3600):
    try:
        email = s.loads(token, salt='email-confirm', max_age=expiration)
    except Exception:
        return False
    return email


db = SQLAlchemy(app)
migrate = Migrate(app, db)


def utc_msk():
    return datetime.utcnow() + timedelta(hours=3)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    confirmed = db.Column(db.Boolean, default=False)
    balance = db.Column(db.Integer, default=0, nullable=False)

    selected_decor = db.relationship('UserSelectedDecor', backref='user', lazy='dynamic')

    @property
    def avatar(self):
        selected = self.selected_decor.join(DecorItem).filter(DecorItem.type == 'avatar').first()
        return selected.decor_item.image if selected else 'icons/user.png'

    @property
    def profile_bg(self):
        selected = self.selected_decor.join(DecorItem).filter(DecorItem.type == 'profile_bg').first()
        return selected.decor_item.image if selected else None

    @property
    def cover_bg(self):
        selected = self.selected_decor.join(DecorItem).filter(DecorItem.type == 'cover_bg').first()
        return selected.decor_item.image if selected else None


class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    game_name = db.Column(db.String(50), nullable=False)
    high_score = db.Column(db.Integer, default=0)
    difficulty = db.Column(db.String(50))

    user = db.relationship('User', backref=db.backref('scores', lazy=True))


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    text = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utc_msk)

    author = db.relationship('User', foreign_keys=[author_id])


class DecorItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    type = db.Column(db.String(50))
    price = db.Column(db.Integer, nullable=False)
    image = db.Column(db.String(200), nullable=False)
    is_active = db.Column(db.Boolean, default=True)


class UserDecorItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    decor_item_id = db.Column(db.Integer, db.ForeignKey('decor_item.id'), nullable=False)
    purchase_date = db.Column(db.DateTime, default=utc_msk)
    user = db.relationship('User', backref=db.backref('decor_items', lazy=True))
    decor_item = db.relationship('DecorItem', backref=db.backref('purchased_by', lazy=True))


class UserSelectedDecor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    decor_item_id = db.Column(db.Integer, db.ForeignKey('decor_item.id'), nullable=False)
    selected_date = db.Column(db.DateTime, default=utc_msk)

    decor_item = db.relationship('DecorItem', backref=db.backref('selected_by', lazy=True))


with app.app_context():
    db.create_all()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        nickname_or_email = request.form['nickname_or_email']
        password = request.form['password']

        user = User.query.filter(
            (User.nickname == nickname_or_email) | (User.email == nickname_or_email)
        ).first()

        if not user.confirmed:
            flash('Ваша почта не подтверждена! Пожалуйста, проверьте свой e-mail и перейдите по ссылке для подтверждения регистрации', 'error')
            return render_template('login.html')
        if user and user.password == password:
            session['user'] = user.nickname
            session['show_welcome'] = True
            return redirect(url_for('menu'))

        flash('Неверный никнейм/почта или пароль', 'error')
        return render_template('login.html')

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        nickname = request.form['nickname']
        email = request.form['email']
        password = request.form['password']
        confirm = request.form['confirm']

        if not nickname or len(nickname) < 3 or len(nickname) > 12:
            flash('Никнейм должен быть от 3 до 12 символов', 'danger')
            return render_template('register.html', nickname=nickname, email=email)

        if not re.match(r'^[A-Za-z0-9_\-]+$', nickname):
            flash('Никнейм может содержать только буквы, цифры, _ и -', 'danger')
            return render_template('register.html', email=email)

        if not email or not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
            flash('Введите корректный e-mail', 'danger')
            return render_template('register.html', nickname=nickname)

        if not password or len(password) < 6:
            flash('Пароль не должен быть короче 6 символов', 'danger')
            return render_template('register.html', nickname=nickname, email=email)

        if password != confirm:
            flash('Пароли не совпадают')
            return render_template('register.html', nickname=nickname, email=email)

        if User.query.filter_by(nickname=nickname).first():
            flash('Никнейм уже существует')
            return render_template('register.html', email=email)

        if User.query.filter_by(email=email).first():
            flash('Почта уже используется')
            return render_template('register.html', nickname=nickname)

        new_user = User(nickname=nickname, email=email, password=password)
        db.session.add(new_user)
        db.session.commit()
        try:
            token = generate_confirmation_token(email)
            confirm_url = url_for('confirm_email', token=token, _external=True)
            msg = Message(
                subject="Подтверждение регистрации",
                recipients=[email],
                html=f"""
                <html>
                <body style="background:#f6f8fa;padding:32px 0;margin:0;">
                  <table align="center" width="440" style="background:#fff;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.07);padding:28px 36px;">
                    <tr>
                      <td align="center" style="font-family:Arial,Helvetica,sans-serif;">
                        <img src="https://img.icons8.com/color/96/000000/verified-account.png" width="48" alt="Подтверждение" style="display:block;margin-bottom:16px;">
                        <h2 style="color:#222;font-size:24px;margin:0 0 12px 0;">Привет, {nickname}!</h2>
                        <p style="font-size:16px;color:#444;margin-bottom:26px;">
                          Спасибо за регистрацию!<br>
                          Чтобы завершить регистрацию, пожалуйста подтвердите e-mail:
                        </p>
                        <a href="{confirm_url}" style="
                            display:inline-block;
                            padding:14px 28px;
                            background:#3CBF71;
                            color:#fff;
                            text-decoration:none;
                            border-radius:6px;
                            font-size:17px;
                            font-weight:bold;
                            margin-bottom:16px;">Подтвердить регистрацию</a>
                        <p style="color:#888;font-size:13px;margin-top:18px;">
                          Если кнопка не работает, перейдите по <a href="{confirm_url}">этой ссылке</a>.<br>
                          Если вы не регистрировались на нашем сайте, проигнорируйте это письмо.
                        </p>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """,
                charset='utf-8'
            )
            mail.send(msg)
        except Exception as e:
            print("Ошибка при отправке письма:", e)

        flash('Подтвердите свою личность, перейдя по ссылке из письма, отправленого на почту', 'info')
        return redirect(url_for('login'))

    return render_template('register.html')


@app.route('/confirm/<token>')
def confirm_email(token):
    email = confirm_token(token)
    if not email:
        flash('Ссылка недействительна или истек срок действия', 'error')
        return redirect(url_for('login'))
    user = User.query.filter_by(email=email).first()
    if user and not user.confirmed:
        user.confirmed = True
        db.session.commit()
        flash('Почта подтверждена! Теперь вы можете войти', 'info')
    else:
        flash('Аккаунт уже подтверждён или не найден', 'error')
    return redirect(url_for('login'))


@app.route('/guest')
def guest():
    session['user'] = 'Гость'
    session['show_welcome'] = True
    return redirect(url_for('menu'))


@app.route('/menu')
def menu():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    show_welcome = session.pop('show_welcome', False)
    return render_template('menu.html', user=user, show_welcome=show_welcome, clear_local_storage=True)


@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))


@app.route('/profile', methods=['GET', 'POST'])
def profile():
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        flash('Необходимо войти в аккаунт')
        return render_template('index.html')

    user = User.query.filter_by(nickname=nickname).first()

    bought_avatar_items = (db.session.query(DecorItem)
                           .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                           .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'avatar')
                           .all())
    bought_profile_bg_items = (db.session.query(DecorItem)
                               .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                               .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'profile_bg')
                               .all())
    bought_cover_bg_items = (db.session.query(DecorItem)
                             .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                             .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'cover_bg')
                             .all())
    # Получить выбранные декоры
    selected_decor = {sd.decor_item.type: sd.decor_item_id for sd in UserSelectedDecor.query.filter_by(user_id=user.id)}

    records = {}
    for game in ['2048', '15-puzzle', 'chess', 'checkers']:
        score = Score.query.filter_by(user_id=user.id, game_name=game).first()
        records[game] = score.high_score if score else None

    # Рекорды по сложностям (minesweeper и sudoku)
    for game in ['minesweeper', 'sudoku']:
        scores = Score.query.filter_by(user_id=user.id, game_name=game).all()
        game_record = {diff: None for diff in ['easy', 'medium', 'hard', 'veryHard']}
        for score in scores:
            if score.difficulty in game_record:
                game_record[score.difficulty] = score.high_score
        records[game] = game_record

    comments = Comment.query.filter_by(user_id=user.id).order_by(Comment.created_at.desc()).all()

    is_own_profile = True

    return render_template('profile.html', user=user, records=records, comments=comments,
                           bought_avatar_items=bought_avatar_items, bought_profile_bg_items=bought_profile_bg_items,
                           bought_cover_bg_items=bought_cover_bg_items, selected_decor=selected_decor,
                           default_avatar="icons/user.png", default_profile_bg="", default_cover_bg="",
                           is_own_profile=is_own_profile)


@app.route('/select_decor/<int:decor_item_id>', methods=['POST'])
def select_decor(decor_item_id):
    user = User.query.filter_by(nickname=session.get('user')).first()

    decor_type = request.form.get('decor_type')

    if decor_item_id == 0:
        # стандартный вариант — просто удалить выбор этого типа
        if not decor_type:
            flash("Неизвестный тип оформления", "danger")
            return redirect(url_for('profile'))
        # Найти выбранный декор такого типа и удалить
        old_selected = (
            UserSelectedDecor.query
            .join(DecorItem)
            .filter(UserSelectedDecor.user_id == user.id, DecorItem.type == decor_type)
            .first()
        )
        if old_selected:
            db.session.delete(old_selected)
            db.session.commit()
        flash("Выбран стандартный вариант!", "success")
        return redirect(url_for('profile'))

    decor_item = DecorItem.query.get(decor_item_id)
    if not decor_item:
        flash("Предмет не найден", "danger")
        return redirect(url_for('profile'))
    # Проверка: куплен ли предмет
    if not UserDecorItem.query.filter_by(user_id=user.id, decor_item_id=decor_item_id).first():
        flash("Сначала купите этот предмет", "warning")
        return redirect(url_for('profile'))
    # Снять предыдущий выбор этого типа
    type_ = decor_item.type
    old_selected = UserSelectedDecor.query.join(DecorItem).filter(
        UserSelectedDecor.user_id == user.id,
        DecorItem.type == type_
    ).first()
    if old_selected:
        old_selected.decor_item_id = decor_item_id
    else:
        db.session.add(UserSelectedDecor(user_id=user.id, decor_item_id=decor_item_id))
    db.session.commit()
    flash("Выбран новый элемент оформления профиля!", "success")
    return redirect(url_for('profile'))


@app.route('/edit_profile', methods=['POST'])
def edit_profile():
    user = User.query.filter_by(nickname=session.get('user')).first()
    nickname = request.form.get('nickname')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')

    if nickname:
        user.nickname = nickname
        session['user'] = nickname

    if new_password:
        if new_password != confirm_password:
            flash('Пароли не совпадают', 'danger')
            return redirect(url_for('profile'))
        user.password = new_password

    db.session.commit()
    flash('Профиль успешно обновлен!', 'success')
    return redirect(url_for('profile'))


@app.route('/game2048')
def game2048():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    max_score = 0
    if nickname != 'Гость':
        user = User.query.filter_by(nickname=nickname).first()
        if user:
            record = Score.query.filter_by(user_id=user.id, game_name='2048').first()
            if record:
                max_score = record.high_score
    return render_template('2048.html', user=user, max_score=max_score)


@app.route('/update_score', methods=['POST'])
def update_score():
    score = int(request.form['score'])
    game = request.form['game']
    nickname = session.get('user')

    user = User.query.filter_by(nickname=nickname).first() if nickname and nickname != 'Гость' else None
    if user is None:
        return '', 204

    existing_score = Score.query.filter_by(user_id=user.id if user else None, game_name=game).first()

    if not existing_score:
        new_score = Score(user_id=user.id if user else None, game_name=game, high_score=score)
        db.session.add(new_score)
    else:
        if game == '15-puzzle':
            if score < existing_score.high_score:
                existing_score.high_score = score
        elif game == '2048' or game == 'chess' or game == 'checkers':
            if score > existing_score.high_score:
                existing_score.high_score = score

    db.session.commit()
    return '', 204


@app.route('/get_high_score')
def get_high_score():
    game = request.args.get('game')
    nickname = session.get('user')

    user = User.query.filter_by(nickname=nickname).first() if nickname and nickname != 'Гость' else None
    score = Score.query.filter_by(user_id=user.id if user else None, game_name=game).first()

    return {'high_score': score.high_score if score else None}


@app.route('/sudoku')
def sudoku():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    return render_template('sudoku.html', user=user)


@app.route('/minesweeper')
def minesweeper():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    return render_template('minesweeper.html', user=user)


@app.route('/15puzzle')
def puzzle15():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    max_score = 0
    if nickname != 'Гость':
        user = User.query.filter_by(nickname=nickname).first()
        if user:
            record = Score.query.filter_by(user_id=user.id, game_name='15-puzzle').first()
            if record:
                max_score = record.high_score
    return render_template('15puzzle.html', max_score=max_score, user=user)


@app.route('/get_best_times')
def get_minesweeper_scores():
    nickname = session.get('user')
    game = request.args.get('game')
    if not nickname or nickname == 'Гость':
        return jsonify({
            'easy': None,
            'medium': None,
            'hard': None,
            'veryHard': None
        })

    user = User.query.filter_by(nickname=nickname).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    scores = Score.query.filter_by(
        user_id=user.id,
        game_name=game
    ).all()

    result = {diff: None for diff in ['easy', 'medium', 'hard', 'veryHard']}
    for score in scores:
        if score.difficulty in result:
            result[score.difficulty] = score.high_score

    return jsonify(result)


@app.route('/update_best_time', methods=['POST'])
def update_minesweeper_score():
    try:
        data = request.get_json()
        difficulty = data.get('difficulty')
        time = data.get('time')
        game = data.get('game')

        if not difficulty or not time:
            return jsonify({'error': 'Missing difficulty or time'}), 400

        nickname = session.get('user')
        if not nickname or nickname == 'Гость':
            return jsonify({'status': 'guest'}), 200

        user = User.query.filter_by(nickname=nickname).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404

        score = Score.query.filter_by(
            user_id=user.id,
            game_name=game,
            difficulty=difficulty
        ).first()

        if score:
            if time < score.high_score:
                score.high_score = time
        else:
            new_score = Score(
                user_id=user.id,
                game_name=game,
                difficulty=difficulty,
                high_score=time
            )
            db.session.add(new_score)

        db.session.commit()
        return jsonify({'status': 'success'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/chess')
def chess():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    return render_template('chess.html', user=user)


@app.after_request
def add_csp(response):
    response.headers['Content-Security-Policy'] = (
        "script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://code.jquery.com 'unsafe-inline' 'unsafe-eval'; "
        "worker-src 'self'; "
        "img-src 'self' data:;"
    )
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    return response


@app.route('/checkers')
def checkers():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    return render_template('checkers.html', user=user)


@app.route('/shop')
def shop():
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        flash('Необходимо войти в аккаунт')
        return redirect(url_for('index'))

    user = User.query.filter_by(nickname=session.get('user')).first()
    decor_items = DecorItem.query.all()
    bought_ids = {udi.decor_item_id for udi in UserDecorItem.query.filter_by(user_id=user.id)}
    return render_template('shop.html', user=user, decor_items=decor_items, bought_ids=bought_ids)


@app.route('/records')
def records():
    top_n = 5

    server_records = {}

    # Function to fetch top N scores for a game
    def get_top_scores(game_name, difficulty=None, order=asc):
        query = (
            Score.query
            .join(User, Score.user_id == User.id)
            .filter(Score.game_name == game_name)
        )
        if difficulty:
            query = query.filter(Score.difficulty == difficulty)

        top_scores = (
            query.order_by(order(Score.high_score))
            .limit(top_n)
            .all()
        )
        # добавь user_id сюда!
        return [{"score": score.high_score, "user": score.user.nickname, "user_id": score.user_id} for score in
                top_scores]

    # Fetch top scores for single games
    single_games = {'2048': desc, '15puzzle': asc, 'chess': desc, 'checkers': desc}
    for game, order in single_games.items():
        server_records[game] = get_top_scores(game, order=order)

    # Fetch top scores for games with difficulties
    difficulty_games = ['minesweeper', 'sudoku']
    difficulties = ['easy', 'medium', 'hard', 'veryHard']
    for game in difficulty_games:
        server_records[game] = {}
        for difficulty in difficulties:
            server_records[game][difficulty] = get_top_scores(game, difficulty)

    nickname = session.get('user', 'Гость')
    user = User.query.filter_by(nickname=nickname).first()

    return render_template('records.html', server_records=server_records, user=user)


@app.route('/about')
def about():
    nickname = session.get('user')
    user = User.query.filter_by(nickname=nickname).first()
    return render_template('about.html', user=user)


@app.route('/profile/<int:user_id>/add_comment', methods=['POST'])
def add_comment(user_id):
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        flash('Сначала войдите в аккаунт')
        return redirect(url_for('index'))

    current_user = User.query.filter_by(nickname=nickname).first()
    text = request.form.get('comment_text')

    if int(sch.predict(text)[0]) == 1:
        flash('Комментарий содержит недопустимые слова.', 'danger')
        return redirect(url_for('profilebyid', user_id=user_id))

    if text:
        comment = Comment(user_id=user_id, author_id=current_user.id, text=text)
        db.session.add(comment)
        db.session.commit()
    return redirect(url_for('profilebyid', user_id=user_id))


@app.route('/profile/<int:user_id>')
def profilebyid(user_id):
    user = User.query.get_or_404(user_id)
    bought_avatar_items = (db.session.query(DecorItem)
                           .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                           .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'avatar')
                           .all())
    bought_profile_bg_items = (db.session.query(DecorItem)
                               .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                               .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'profile_bg')
                               .all())
    bought_cover_bg_items = (db.session.query(DecorItem)
                             .join(UserDecorItem, UserDecorItem.decor_item_id == DecorItem.id)
                             .filter(UserDecorItem.user_id == user.id, DecorItem.type == 'cover_bg')
                             .all())

    selected_decor = {sd.decor_item.type: sd.decor_item_id for sd in UserSelectedDecor.query.filter_by(user_id=user.id)}

    records = {}
    for game in ['2048', '15-puzzle', 'chess', 'checkers']:
        score = Score.query.filter_by(user_id=user.id, game_name=game).first()
        records[game] = score.high_score if score else None

    # Рекорды по сложностям (minesweeper и sudoku)
    for game in ['minesweeper', 'sudoku']:
        scores = Score.query.filter_by(user_id=user.id, game_name=game).all()
        game_record = {diff: None for diff in ['easy', 'medium', 'hard', 'veryHard']}
        for score in scores:
            if score.difficulty in game_record:
                game_record[score.difficulty] = score.high_score
        records[game] = game_record

    comments = Comment.query.filter_by(user_id=user.id).order_by(Comment.created_at.desc()).all()

    nickname = session.get('user')
    current_user = User.query.filter_by(nickname=nickname).first()
    is_own_profile = current_user.id == user_id if current_user else False

    return render_template('profile.html', user=user, records=records, comments=comments,
                           bought_avatar_items=bought_avatar_items, bought_profile_bg_items=bought_profile_bg_items,
                           bought_cover_bg_items=bought_cover_bg_items, selected_decor=selected_decor,
                           default_avatar="icons/user.png", default_profile_bg="", default_cover_bg="",
                           is_own_profile=is_own_profile, current_user=current_user)


@app.route('/buy_decor_item/<int:item_id>', methods=['POST'])
def buy_decor_item(item_id):
    user = User.query.filter_by(nickname=session.get('user')).first()
    item = DecorItem.query.get(item_id)
    if not user or not item:
        flash("Ошибка покупки", "danger")
        return redirect(url_for('shop'))
    if UserDecorItem.query.filter_by(user_id=user.id, decor_item_id=item.id).first():
        flash("Вы уже купили этот предмет!", "info")
        return redirect(url_for('shop'))
    if user.balance < item.price:
        flash("Недостаточно средств!", "warning")
        return redirect(url_for('shop'))
    user.balance -= item.price
    db.session.add(UserDecorItem(user_id=user.id, decor_item_id=item.id))
    db.session.commit()
    flash(f"Вы купили: {item.name}", "success")
    return redirect(url_for('shop'))


@app.route('/api/game_result', methods=['POST'])
def game_result():
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        return

    data = request.json

    if data.get('game') == 'minesweeper':
        base_reward = {'easy': 3, 'medium': 8, 'hard': 20, 'veryHard': 30}
        coins = base_reward.get(data['difficulty'])
        if not data.get('win'):
            coins = int(coins * 0.1)
            coins = int(coins * data.get('time') * 0.3)
        else:
            time_bonus = max(1, int(100 / data.get('time')))
            time_bonus = 3 if time_bonus < 3 else time_bonus
            coins = int(coins * time_bonus)
            if data['difficulty'] == 'hard':
                coins *= 5
            elif data['difficulty'] == 'veryHard':
                coins *= 10
        if data.get('usedHint'):
            coins = int(coins * 0.4)

    elif data.get('game') == 'sudoku':
        base_reward = {'easy': 5, 'medium': 10, 'hard': 15, 'veryHard': 20}
        coins = base_reward.get(data['difficulty'])
        
        if not data.get('win'):
            coins = int(coins * 0.1)
        else:
            time_bonus = max(1, int(300 / data.get('time')))
            time_bonus = 7 if time_bonus > 7 else time_bonus
            coins = int(coins * time_bonus * 0.3)

            if data['difficulty'] == 'hard':
                coins *= 2
            elif data['difficulty'] == 'veryHard':
                coins *= 3

        if data.get('usedHint'):
            coins = int(coins * 0.2)

    elif data.get('game') == '15-puzzle':
        coins = int(50 * max(1, int(500/data.get('moveCount'))))
        if data.get('usedHint'):
            coins = int(coins * 0.5)

    elif data.get('game') == '2048':
        coins = int(data.get('score')/100)
        if data.get('usedHint'):
            coins = int(coins * 0.5)
        if data.get('win'):
            coins = 500
    elif data.get('game') == 'chess':
        coins = int(data.get('elo')/20)
        if not data.get('win'):
            coins = int(coins * 0.3)
    elif data.get('game') == 'checkers':
        coins = int(data.get('skill'))
        if data.get('win'):
            coins *= 5

    user = User.query.filter_by(nickname=session.get('user')).first()
    user.balance += coins
    db.session.commit()

    n = abs(int(coins))
    if n % 10 == 1 and n % 100 != 11:
        pluralize_word = "монету"
    elif n % 10 in [2, 3, 4] and n % 100 not in [12, 13, 14]:
        pluralize_word = "монеты"
    else:
        pluralize_word = "монет"

    return jsonify({'coins': coins, 'pluralize_word': pluralize_word})


if __name__ == '__main__':
    app.run(debug=True)
