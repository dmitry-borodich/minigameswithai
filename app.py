from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc, asc
from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer
import os

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 465
app.config['MAIL_USE_SSL'] = True
app.config['MAIL_USERNAME'] = 'leepteen@gmail.com'
app.config['MAIL_PASSWORD'] = 'qmbw iuru krmm gmlz'
app.config['MAIL_DEFAULT_SENDER'] = 'leepteen@gmail.com'

mail = Mail(app)

s = URLSafeTimedSerializer(app.secret_key)

def generate_confirmation_token(email):
    return s.dumps(email, salt='email-confirm')
def confirm_token(token, expiration=3600):
    try:
        email = s.loads(token, salt='email-confirm', max_age=expiration)
    except Exception:
        return False
    return email

db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    confirmed = db.Column(db.Boolean, default=False)

class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    game_name = db.Column(db.String(50), nullable=False)
    high_score = db.Column(db.Integer, default=0)
    difficulty = db.Column(db.String(50))

    user = db.relationship('User', backref=db.backref('scores', lazy=True))

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # чей профиль
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # кто написал
    text = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


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
                body=f'Здравствуйте, {nickname}!\nДля подтверждения регистрации перейдите по ссылке: {confirm_url}',
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
        flash('Ссылка недействительна или истек срок действия.', 'error')
        return redirect(url_for('login'))
    user = User.query.filter_by(email=email).first()
    if user and not user.confirmed:
        user.confirmed = True
        db.session.commit()
        flash('Почта подтверждена! Теперь вы можете войти.', 'info')
    else:
        flash('Аккаунт уже подтверждён или не найден.', 'error')
    return redirect(url_for('login'))
@app.route('/guest')
def guest():
    session['user'] = 'Гость'
    session['show_welcome'] = True
    return redirect(url_for('menu'))

@app.route('/menu')
def menu():
    user = session.get('user', 'Гость')
    show_welcome = session.pop('show_welcome', False)
    return render_template('menu.html', user=user, show_welcome=show_welcome)

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('index'))

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        flash('Сначала войдите в аккаунт')
        return redirect(url_for('index'))

    user = User.query.filter_by(nickname=nickname).first()

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

    if request.method == 'POST':
        new_nickname = request.form['nickname']
        new_pass = request.form['new_password']
        confirm = request.form['confirm_password']

        if new_pass and new_pass != confirm:
            flash('Пароли не совпадают')
            return render_template('profile.html', user=user, records=records)

        if new_nickname != nickname:
            if User.query.filter_by(nickname=new_nickname).first():
                flash('Никнейм уже занят')
                return render_template('profile.html', user=user, records=records)
            user.nickname = new_nickname
            session['user'] = new_nickname

        if new_pass:
            user.password = new_pass

        db.session.commit()
        flash('Данные обновлены', 'info')
        return redirect(url_for('profile'))

    return render_template('profile.html', user=user, records=records)

@app.route('/game2048')
def game2048():
    nickname = session.get('user', 'Гость')
    max_score = 0
    if nickname != 'Гость':
        user = User.query.filter_by(nickname=nickname).first()
        if user:
            record = Score.query.filter_by(user_id=user.id, game_name='2048').first()
            if record:
                max_score = record.high_score
    return render_template('2048.html', user=nickname, max_score=max_score)

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
        elif game == '2048' or game == 'chess':
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
    user = session.get('user', 'Гость')
    return render_template('sudoku.html', user=user)

@app.route('/minesweeper')
def minesweeper():
    user = session.get('user', 'Гость')
    return render_template('minesweeper.html', user=user)

@app.route('/15puzzle')
def puzzle15():
    nickname = session.get('user', 'Гость')
    max_score = 0
    if nickname != 'Гость':
        user = User.query.filter_by(nickname=nickname).first()
        if user:
            record = Score.query.filter_by(user_id=user.id, game_name='15-puzzle').first()
            if record:
                max_score = record.high_score
    return render_template('15puzzle.html', max_score=max_score, user=nickname)


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

        # Находим или создаем запись
        score = Score.query.filter_by(
            user_id=user.id,
            game_name=game,
            difficulty=difficulty
        ).first()

        if score:
            if time < score.high_score:  # Для сапёра меньше время = лучше
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
    user = session.get('user', 'Гость')
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
    user = session.get('user', 'Гость')
    return render_template('checkers.html', user=user)

@app.route('/shop')
def shop():
    user = session.get('user', 'Гость')
    return render_template('shop.html', user=user)

@app.route('/records')
def records():
    top_n = 5  # Number of top scores to retrieve

    server_records = {}

    # Function to fetch top N scores for a game
    def get_top_scores(game_name, difficulty=None, order=desc):
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
        return [{"score": score.high_score, "user": score.user.nickname} for score in top_scores]

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

    return render_template('records.html', server_records=server_records, nickname=nickname)

@app.route('/about')
def about():
    user = session.get('user', 'Гость')
    return render_template('about.html', user=user)


@app.route('/profile/<int:user_id>/add_comment', methods=['POST'])
def add_comment(user_id):
    nickname = session.get('user')
    if not nickname or nickname == 'Гость':
        flash('Сначала войдите в аккаунт')
        return redirect(url_for('index'))

    current_user = User.query.filter_by(nickname=nickname).first()
    text = request.form.get('comment_text')
    if text:
        comment = Comment(user_id=user_id, author_id=current_user.id, text=text)
        db.session.add(comment)
        db.session.commit()
    return redirect(url_for('profile', user_id=user_id))

@app.route('/profile/<int:user_id>')
def profilebyid(user_id):
    user = User.query.get_or_404(user_id)
    comments = (
        Comment.query.filter_by(user_id=user_id)
        .order_by(Comment.created_at.desc())
        .all()
    )

if __name__ == '__main__':
    app.run(debug=True)
