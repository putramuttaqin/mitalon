import os
from flask import Flask, request, render_template
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024  # 2MB limit

# Create upload folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/', methods=['GET', 'POST'])
def form():
    if request.method == 'POST':
        nip = request.form['nip']
        name = request.form['name']
        image = request.files['image']

        if image:
            filename = secure_filename(image.filename)
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(image_path)
            return render_template('result.html', nip=nip, name=name, image=filename)
        else:
            return "Image upload failed."

    return render_template('form.html')

if __name__ == '__main__':
    app.run(debug=True)
