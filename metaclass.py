from random import choice

def generate_guid():
	ALLOWED_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890' # Shouldn't use: /&?%\;"':
	SESSION_TOKEN_LENGTH = 20
	session_token = ''
	for i in range(SESSION_TOKEN_LENGTH):
		session_token += choice(ALLOWED_CHARS)
	return session_token

class InstanceUnifier(type):
	'''
		What we want: A metaclass that can give a class an array of instances and provide a static Class.all object, that, when a method is called on it, calls the same method on every instance of the class.
	'''
	def __new__(cls, name, base_classes, dct):
		if not type(dct['instances']) in (list, dict):
			raise TypeError('Specify an instances array or dict.')
		return type.__new__(cls, name, base_classes, dct)

	def __init__(cls, name, base_classes, dct):
		# def to_dict(obj):
		# 	if type(obj) == list:
		# 		return {key: val for key, val in enumerate(obj)}
		# 	elif type(obj) == dict:
		# 		return obj
		class Accessor(object):
			def __getattribute__(self, name):
				if type(cls.instances) == list:
					array = [getattr(inst, name) for inst in cls.instances]
					if all([callable(item) for item in array]):
						def proxy_func(*args, **kwargs):
							for this in cls.instances:
								func = getattr(this, name)
								func(*args, **kwargs)
						return proxy_func
					else:
						return array
				elif type(cls.instances) == dict:
					array = [getattr(cls.instances[pk], name) for pk in cls.instances]
					if all([callable(item) for item in array]):
						def proxy_func(*args, **kwargs):
							for pk in cls.instances.keys():
								func = getattr(cls.instances[pk], name)
								func(*args, **kwargs)
						return proxy_func
					else:
						return {pk: getattr(cls.instances[pk], name) for pk in cls.instances}

			def __setattr__(self, name, value):
				if type(cls.instances) == list:
					[setattr(inst, name, value) for inst in cls.instances]
				elif type(cls.instances) == dict:
					[setattr(cls.instances[pk], name, value) for pk in cls.instances]

		cls.all = Accessor()

		def destruct(self):
			if type(cls.instances) == list:
				cls.instances.remove(self)
			elif type(cls.instances) == dict:
				pk_val = getattr(self, cls.primary_key)
				del cls.instances[pk_val]
		cls.destruct = destruct

		return type.__init__(cls, name, base_classes, dct)

	def __call__(cls, *args, **kwargs):
		inst = type.__call__(cls, *args, **kwargs)
		if type(cls.instances) == dict:
			pk_val = generate_guid()
			setattr(inst, cls.primary_key, pk_val)
			cls.instances[pk_val] = inst
		elif type(cls.instances) == list:
			cls.instances.append(inst)
		return inst
