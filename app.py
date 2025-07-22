from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('home.html')  # New homepage

@app.route('/form')
def form():
    return render_template('form.html')  # Your existing form (formerly index.html)

# Keep your existing routes...
# @app.route('/upload', methods=['POST'])
# def upload(): ...

if __name__ == '__main__':
    app.run(debug=True)