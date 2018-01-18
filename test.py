from bottle import route, run, static_file

@route('/bkg.jpg')
def bkg():
	return static_file('CachedImage_1280_1024_POS4.jpg', root='C:\Users\1moorer\Documents\mentr')

run(host='127.0.0.1', port=8080)