const aws = require('aws-sdk');
var http = require("http");
var express = require('express');
var app = express();
var mysql      = require('mysql');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt');
var uuidv4 = require('uuid/v4');
var EmailValidator = require('email-validator');
var multer = require('multer');
var path = require('path');
var url = require('url');
const fs = require('fs');
const multerS3 = require('multer-s3');
require('dotenv').config({ path: '/home/centos/webapp/var/.env' });
const Config = require('./conf.js');
const conf = new Config();
var SDC = require('statsd-client'),
    sdc = new SDC({host: 'localhost'});

	const log4js = require('log4js');
	log4js.configure({
	  appenders: { logs: { type: 'file', filename: '/home/centos/webapp/logs/webapp.log' } },
	  categories: { default: { appenders: ['logs'], level: 'info' } }
	});
	 
	const logger = log4js.getLogger('logs');
	/*logger.trace('Entering cheese testing');
	logger.debug('Got cheese.');
	logger.info('Cheese is Comté.');
	logger.warn('Cheese is quite smelly.');
	logger.error('Cheese is too ripe!');
	logger.fatal('Cheese was breeding ground for listeria.');*/

/*	
	var logger = require('./log.js');
	logger.info('*** Requested for First log... ***');
*/
var signedUrlExpireSeconds = 60 * 2;

console.log("---- process env -----",process.env);

//global common variables
var imageDir = conf.image.imageBucket;
var imagePath = conf.image.imageurl+imageDir;
console.log("conf ------",conf,"++++++++++++++",);
//return false;

//start mysql connection
var connection = mysql.createConnection({
		host     : conf.db.host,
		user     : conf.db.user,
		port 	 : '3306',
		password : conf.db.password,
		database : conf.db.database
});

connection.connect(function(err) {
  if (err){
		logger.fatal(err);
		console.log(err);
	  	throw err;
	}else{
		connection.query("CREATE TABLE IF NOT EXISTS `user` (`id` INT NOT NULL AUTO_INCREMENT,`username` VARCHAR(255) NOT NULL,`password` VARCHAR(255) NOT NULL,`cdate` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY (`id`)) ENGINE=InnoDB;",function (erro, find) {
		    if(find.warningCount == 1) { console.log("users already exists"); }
		    else{ logger.info('users table created successfully'); console.log(find,"users table created successfully"); }
		});
		connection.query('CREATE TABLE IF NOT EXISTS `book` (`id` VARCHAR(255) NOT NULL,`title` VARCHAR(255) NOT NULL,`author` VARCHAR(100) NULL,`isbn` VARCHAR(255) NULL,`quantity` INT NULL,`image` VARCHAR(255),PRIMARY KEY (`id`));',function (erro, find) {
		    if(find.warningCount == 1) { console.log("books already exists"); }
		    else{ logger.info('book table created successfully'); console.log(find,"book table created successfully"); }
		});
		connection.query('CREATE TABLE IF NOT EXISTS `image` (`img_id` VARCHAR(255) NOT NULL,`url` VARCHAR(255) NULL);',function (erro, find) {
		    if(find.warningCount == 1) { console.log("images already exists"); }
		    else{ logger.info('image table created successfully'); console.log("image table created successfully"); }
		});
	}
})
//end mysql connection

//start body-parser configuration
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
//end body-parser configuration

//create app server
var server = app.listen(3000, function () {
  logger.trace('App started');
  var host = server.address().address
  var port = server.address().port
  console.log("Example app listening at http://%s:%s", host, port)
});

const saltRounds = conf.salt.rounds;
const myPlaintextPassword = conf.salt.pass;
const someOtherPlaintextPassword = conf.salt.plainpass;

DEBUG_MODE_ON = true;
if (!DEBUG_MODE_ON) {
	console = console || {};
	console.log = function(){};
}

var metadata = new aws.MetadataService();
function getEC2Credentials(rolename){
	var promise = new Promise((resolve,reject)=>{
		metadata.request('/latest/meta-data/iam/security-credentials/'+rolename,function(err,data){
			if(err){
				logger.fatal(err);
				reject(err);   
			}else{
				resolve(JSON.parse(data));
			} 
		});
	});

	return promise;
};

s3 = null;
if(process.env.NODE_ENV == 'prod'){
	s3 = new aws.S3();
	/*
	var credentials = new aws.SharedIniFileCredentials({profile: 'default'});
	aws.config.credentials = credentials;
	console.log("s3---------",aws.config.credentials);
	//return false;
	*/
	getEC2Credentials('CodeDeployEC2ServiceRole').then((credentials)=>{
		//console.log("\n----- credentials ------",credentials);
		aws.config.accessKeyId=credentials.AccessKeyId;
        aws.config.secretAccessKey=credentials.SecretAccessKey;
        aws.config.sessionToken = credentials.Token;
    }).catch((err)=>{
		logger.fatal(err);
		console.log("\n-----errrrr------",err);
    });	
}


var storages3 = multerS3({
	s3: s3,
	bucket: conf.image.imageBucket,
	key: function (req, file, cb) {
	  if(req.do=='update'){	
		  ext = path.extname(file.originalname);
		  allowedformats = ['.jpg','.jpeg','.png'];  
		  console.log(" exttion cascasc hyat aahe value ",allowedformats.indexOf(ext),file);
		  if(allowedformats.indexOf(ext) != -1){
			  connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
				  if(erro) res.status(403).json({message:"Error occurred"});
				  if(find.length == 0){ cb(3); }else{
				  if(find[0].image != null){
					  connection.query('UPDATE image SET url=? WHERE img_id =?',[find[0].image+ext,find[0].image],function (erro, findR) {
						  if(erro) res.status(404).json({message:"Not Found"});
						  if(findR.affectedRows){
							  console.log("imgId+ext------",find[0].image+ext);
							  cb(null, find[0].image+ext);										
						  }else {
							  cb(3);
						  }
					  });
				  }else {
					  cb(2);
				  }
				  }
			  });
						  
		  }else{
			  cb(1);		// 1 for not match 
		  }
	  }else{
		  ext = path.extname(file.originalname);
		  allowedformats = ['.jpg','.jpeg','.png'];  
		  console.log(" exttion value ",allowedformats.indexOf(ext),file);
		  if(allowedformats.indexOf(ext) != -1){
			  connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
				  if(erro) res.status(404).json({message:"Not Found"});
				  console.log("\n-----------",find,req.params.id)
				  if(find.length > 0 && find[0].image == null){
					  var imgId = uuidv4();
					  connection.query('INSERT INTO image (img_id,url) VALUES (?,?)',[imgId,imgId+ext],function (erro, findRe) {
						  if(erro) res.status(404).json({message:"Not Found"});
						  if(findRe.affectedRows > 0){
							  connection.query('UPDATE book SET image=? WHERE id =?',[imgId,req.params.id],function (erro, findR) {
								  if(erro) res.status(404).json({message:"Not Found"});
								  if(findR.affectedRows){
									  cb(null, imgId+ext);										
								  }else {
									  cb(3);
								  }
							  });
						  }else {
							  cb(3);
						  }
					  });
					  
				  }else {
					  cb(2);
				  }
			  });	
				  
		  }else{
			  cb(1);		// 1 for not match 
		  }				
	  }
	}
  })

var deletefile = function(filenamev){
	var params = {  Bucket: imageDir, Key: filenamev };
	s3.deleteObject(params, function(err, data) {
	  if (err) {
		logger.fatal(err);
		console.log(err, err.stack);  // error
	  }else{
		console.log("file deleted");
	  }                      // deleted
	});  
}  
  
app.post('/user/register',(req,res)=>{
	sdc.increment('create user');
	let username = req.body.username;
		let pass = req.body.password;
		console.log('req----',req.body,req.body.password, EmailValidator.validate(username));
		if(!EmailValidator.validate(username)){
			logger.warn('Email Id not valid');
			return res.status(401).json({ message: 'Email Id not valid' });
		}
		

		connection.query('SELECT * FROM user WHERE username = ?',[username], function (error, results, fields) {
  			if (error) {
				logger.error(error);
				throw error;
			}else{
  				//console.log('Data is ', results.length);
				if(results.length > 0){
					console.log('Data is true', results.length)
					logger.info("user already exists");
					res.json({ message:"user already exists" });	
				}else{
					console.log('Data is false', results.length)
					let strongRegex = new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})");
					let status = strongRegex.test(pass);
					console.log("status",status);
					if(status){
						bcrypt.hash(pass, saltRounds, function(err, hash) {
							//console.log('hash-------',hash);
							if(err) throw err;							
							connection.query('INSERT INTO user (username, password) VALUES (?, ?); ',[username,hash], function (error, results, fields) {
  								if (error){
									logger.error(error);
									throw error;
								  }else{
									logger.info('added successfully');  
									console.log('The solution is: ', results[0]);
									res.json({ message:'added successfully' });
								  }							
							});  			
						});
					}else{
						logger.error('password not containg nist stadards');  
						res.json({ message:'password not containg nist stadards' });					
					}
										
				}
			}
		});				
	})

	// global authorization check app
	app.all('*',function(req,res,next){
		if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
			logger.error('password not containg nist stadards');  
			return res.status(401).json({ message: 'User not logged in' });
		}else{
			var header=req.headers['authorization']||'',
				token=header.split(/\s+/).pop()||'',
				auth=new Buffer.from(token, 'base64').toString(),
				parts=auth.split(/:/),
				username=parts[0],
				password=parts[1];
	
			connection.query('SELECT * FROM user WHERE username = ?',[username], function (error, results, fields) {
				if (error) {
					logger.error('No such user');
					res.status(401).json({ message : 'No such user' });
				}else{
					if(results.length > 0){
						bcrypt.compare(password, results[0].password, function(err, resv) {
							console.log("res---------",resv);    				
							// res == true
							if (error){
								logger.error(error);
								throw error;	
							} 	
							if(resv){
								next();
								//res.json({ crrdate : new Date().toISOString() });
							}else{
								logger.error('password does not match');
								res.status(401).json({ message : 'password does not match' });
							}
						});	
					}else{
						logger.error('user does not exists');
						console.log('Data is false', results.length)
						res.status(401).json({ message : 'user does not exists' });
					}
				}
			});
		}		
	});

	//get /book/{id}
	app.get('/book/:id', function (req, res){
		sdc.increment('get book');
		logger.info("inside get book");
		var bookid=req.params.id;
		connection.query('SELECT * FROM book WHERE id =?',[bookid],function (erro, find) {
		    if(erro) {
				logger.error("Not Found");
				res.status(404).json({message:"Not Found"});
			}
		    if(find.length>0){
				if(find[0].image != null){
					connection.query('SELECT * FROM image WHERE img_id = ?',[find[0].image],function (error,resultSelect, field) {
						if(error) res.status(204).json({message:"No image Content to delete"}); 
						if(resultSelect.length > 0){
							url = '';
							if(process.env.NODE_ENV == "dev"){
								url = imagePath+resultSelect[0].url;
							}else{
								url = s3.getSignedUrl('getObject', {
									Bucket: conf.image.imageBucket,
									Key: resultSelect[0].url,
									Expires: signedUrlExpireSeconds
								})	
							}
							find[0].image = {'id':find[0].image,'url':url}
							console.log("find",find);
							res.json(find);								
						}
					});			
				}else{
					logger.error("Not Found");
					res.json(find);
				}
			}
			else {
				logger.error("Not Found");
				res.status(404).json({message:"Not Found"});
			}
		});
	});



	app.get('/book' , (req, res )=>{
		//res.json({msg : 'in book app'});
		sdc.increment('get all books');
		logger.info("insdie get all books");

		connection.query( "SELECT * From book LEFT JOIN image ON book.image = image.img_id", function(err, result, field){
			if (err) res.status(400).json({ message:'Error occurred' });
            if(result.length > 0){
				console.log("result all books",result);
				//res.json(result);
				for (var i in result) {
					val = result[i];
					//val.image = {'id':val.image,'url':imagePath+resultSelect[0].url};
					console.log(val);
					if(val.image != null){
						url = null;
						if(process.env.NODE_ENV == "dev"){
							url = imagePath+val.url;
						}else{
							url = s3.getSignedUrl('getObject', {
								Bucket: conf.image.imageBucket,
								Key: val.url,
								Expires: signedUrlExpireSeconds
							})	
						}

						result[i].image = {'id':val.image,'url':url};
					}
					delete result[i].url;
					//console.log(i,'--------',result.length)
					if(i == result.length-1){
						res.json(result);
					}
				}
			}else{
				logger.info("No Content");
				res.status(204).json({message:"No Content"});
			}
		 });
	 });

	//DELETE /book/{id}
	app.delete('/book/:id', function (req, res){
		sdc.increment('delete book');
		logger.info('inside delete book');
		var bookid=req.params.id;
	    connection.query('select * FROM book WHERE id = ?',[bookid],function (error,resultB, field) {
			if(error) {
				logger.error('No Content to delete'); 
				res.status(204).json({message:"No Content to delete"});
			}
			if(resultB.length > 0){
				connection.query('DELETE FROM book WHERE id = ?',[bookid],function (error,result, field) {
					if(error || !result){ 
						logger.error(error);
						res.status(204).json({message:"No Content"});
					}else{
						if(resultB[0].image != null){
							connection.query('SELECT * FROM image WHERE img_id = ?',[resultB[0].image],function (error,resultSelect, field) {
								if(error) {
									logger.error('No image Content to delete'); 
									res.status(204).json({message:"No image Content to delete"});
								}
								if(resultSelect.length > 0){
									connection.query('DELETE FROM image WHERE img_id = ?',[resultB[0].image],function (error,resulti, field) {
										if(error) {
											logger.error('No image Content to delete');
											res.status(204).json({message:"No image Content to delete"}); 
										}
										if(process.env.NODE_ENV == "dev"){
											fs.unlink(imageDir+resultSelect[0].url);
										}else{
											deletefile(resultSelect[0].url);
										}
										logger.info('deleted successfully'); 
										res.json({message:"deleted successfully"});
									});
								}else{
									logger.error('image does not exists in table'); 
									res.status(404).json({message:"image does not exists in table"});
								}	
							});		
						}else{
							logger.info('deleted successfully'); 
							res.json({message:"deleted successfully"});
						}
					}
				});
			}else{
				logger.error('No Content to delete'); 
				res.status(204).json({message:"No Content to delete"});
			} 
		});	
	});

	// mount the facets resource
	//app.use('/facets', facets({ config, connection }));

	//Basic app returns date  
	app.get('/', function (req, res){
                //testing statsd client
        sdc.increment('basic date return');
		logger.info('inside basic date return'); 
		var header=req.headers['authorization']||'',
		token=header.split(/\s+/).pop()||'',
		auth=new Buffer.from(token, 'base64').toString(),
		parts=auth.split(/:/),
	      	username=parts[0],
		password=parts[1];
	
		connection.query('SELECT * FROM user WHERE username = ?',[username], function (error, results, fields) {
			if (error) {
				logger.error(error); 
				throw error;
			}else{
				if(results.length > 0){
					bcrypt.compare(password, results[0].password, function(err, resv) {
						console.log("res---------",resv);    				
						// res == true
						if (error) {
							logger.error(error); 
							throw error;	
						}
						if(resv){
							logger.info(new Date().toISOString()); 
							res.json({ crrdate : new Date().toISOString() });
						}else{
							logger.error('password does not match'); 
							res.json({ message : 'password does not match' });
						}
					});	
				}else{
					logger.error('user does not exists'); 
					console.log('Data is false', results.length)
					res.json({ message : 'user does not exists' });
				}
			}
		});
	});
	
	//book create app	
	app.post('/book', (req, res) => {
		sdc.increment('create books');
		logger.info('inside create book'); 
		let id = (req.body.id) ? req.body.id.trim() : '';
		let title = (req.body.title) ? req.body.title.trim() : '';
		let author = (req.body.author) ? req.body.author.trim() : '';
		let isbn = (req.body.isbn) ? req.body.isbn.trim() : '';
		let quantity = req.body.quantity;
		let url = (req.body.image) ? req.body.image.url.trim() : '';
		
		if(title.length > 0 && author.length > 0 && isbn.length > 0 && Number.isInteger(quantity) && quantity > 0){			
			var imageid = null;
			if(url){
				imageid = uuidv4();
			}
			connection.query('INSERT INTO book (`id`, `title`, `author`, `isbn`,`quantity`,`image`) VALUES (?,?,?,?,?,?)',[uuidv4(),title,author,isbn,quantity,imageid], function (error, results, fields) {
	  			if (error) {
					logger.error(error); 
					throw res.status(400).json({ message:"connection error",err:error });
				}else{
					//console.log("result-----",results);
					if(results){
						if(url){
							connection.query('INSERT INTO image (id,url) VALUES (?,?)',[imageid,url],function (erro, findRe) {
								if(erro){
									logger.error("error occured while inserting image"); 
									res.status(404).json({message:"error occured while inserting image"});
								}
								if(findRe.affectedRows > 0){
									res.status(201).json({ message:'created' });
								}else{
									res.status(201).json({ message:'created' });
								}
							});
						}else{
							res.status(201).json({ message:'created' });
						}
				}else{
					logger.error(error); 
					res.status(400).json({ message:"connection error",err:error });
					}
				}
			});
		}else{
			logger.error("Bad Request"); 
			res.status(400).json({ message:"Bad Request" });
		}				
	});
	
	//book update app	
	app.put('/book', (req, res) => {
		sdc.increment('update book');
		logger.info("inside update book"); 
		let id = req.body.id.trim();
		let title = req.body.title.trim();
		let author = req.body.author.trim();
		let isbn = req.body.isbn.trim();
		let quantity = req.body.quantity;
		let imgurl = (req.body.image) ? req.body.image.url.trim() : '';
		console.log("req.body.image----------",req.body.image);	

		if(id.length > 0 && (title.length > 0 || author.length > 0 || isbn.length > 0 || quantity > 0)){
			connection.query('SELECT * from book WHERE id = ?',[id], function (error, results, fields) {
				if (error){
					logger.error(error); 
					throw res.status(400).json({ message:'Error occurred' });
				} 
				if(results.length > 0){
					var imgid = uuidv4();
					if(results[0].image){
						imgid = results[0].image;
					}
					var query = 'UPDATE book SET ';
					console.log("query --------",query);	            			
					query = query + ((title.length > 0) ? ' title = "'+title+'"' : '');
					query = query + ((title.length > 0) ? ',' : '');
					query = query + ((author.length > 0) ? ' author = "'+author+'"' : '');
					query = query + ((author.length > 0) ? ',' : '');
					query = query + ((isbn.length > 0) ? ' isbn = "'+isbn+'"' : '');
					query = query + ((isbn.length > 0) ? ',' : '');
					query = query + ((imgid.length > 0) ? ' image = "'+imgid+'"' : '');
					query = query + ((imgid.length > 0) ? ',' : '');
					query = query + ((quantity > 0) ? ' quantity = "'+quantity+'"' : '');
					if(quantity < 0){
						logger.error("bad request"); 
						res.status(400).json({ message:"Bad Request" });
						return false;
					}
					query = query.replace(/,\s*$/, "");				
					query = query + ' WHERE id = "'+id+'"';
					console.log("query --------",query);
					connection.query(query, function (error, resultsn, fields) {
						if (error) {
							logger.error(error); 
							throw res.status(400).json({ message:'Error occurred',err:error });
						}
						if(resultsn.affectedRows > 0){
							connection.query('select * from image WHERE img_id =?',[results[0].image],function (erro, findR) {
								if(erro) {
									logger.error(erro); 
									res.status(404).json({message:"Not Found"});
								}
								if(imgurl){
									if(findR.length > 0){
										connection.query('UPDATE image SET url=? WHERE id =?',[imgurl,results[0].image],function (erro, findR) {
											if(erro) res.status(404).json({message:"Not Found"});
											if(findR.affectedRows){
												//console.log("imgId+ext------",find[0].image+ext);
												logger.info('Content updated successfully'); 
												res.status(200).json({ message:'Content updated successfully' });
											}else {
												logger.info('Content updated successfully'); 
												res.status(200).json({ message:'Content updated successfully' });
											}
										});		
									}else{
										connection.query('INSERT INTO image (id,url) VALUES (?,?)',[imgid,imgurl],function (erro, findR) {
											if(erro) {
												logger.error(erro); 
												res.status(404).json({message:"Not Found"});
											}
											if(findR.length > 0){
												//console.log("imgId+ext------",find[0].image+ext);
												logger.info('Content updated successfully'); 
												res.status(200).json({ message:'Content updated successfully' });
											}else {
												logger.info('Content updated successfully'); 
												res.status(200).json({ message:'Content updated successfully' });
											}
										});
									}	
								}else{
									logger.info('Content updated successfully'); 
									res.status(200).json({ message:'Content updated successfully' });
								}
							});

						}else{
							logger.error('400 error occured'); 
							res.status(400).json({ message:'Error occurred' });								
						}
					});			
				}else{
					logger.error('204 no content'); 
					res.status(204).json({ message:'No Content' });
				}
			});		
		}else{
			logger.error('400 bad request'); 
			res.status(400).json({ message:"Bad Request" });
		}
    });


	var storage = multer.diskStorage({
		destination: function (req, file, cb) {
		  cb(null, imageDir)
		},
		filename: function (req, file, cb) {
		if(req.do=='update'){	
			ext = path.extname(file.originalname);
			allowedformats = ['.jpg','.jpeg','.png'];  
			console.log(" exttion cascasc hyat aahe value ",allowedformats.indexOf(ext),file);
			if(allowedformats.indexOf(ext) != -1){
				connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
					if(erro) res.status(403).json({message:"Error occurred"});
					if(find.length == 0){ cb(3); }else{
					if(find[0].image != null){
						connection.query('UPDATE image SET url=? WHERE img_id =?',[find[0].image+ext,find[0].image],function (erro, findR) {
							if(erro) res.status(404).json({message:"Not Found"});
							if(findR.affectedRows){
								console.log("imgId+ext------",find[0].image+ext);
								cb(null, find[0].image+ext);										
							}else {
								cb(3);
							}
						});
					}else {
						cb(2);
					}
					}
				});
							
			}else{
				cb(1);		// 1 for not match 
			}
		}else{
			ext = path.extname(file.originalname);
			allowedformats = ['.jpg','.jpeg','.png'];  
			console.log(" exttion value ",allowedformats.indexOf(ext),file);
			if(allowedformats.indexOf(ext) != -1){
				connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
					if(erro) {
						logger.error('404 Not Found'); 
						res.status(404).json({message:"Not Found"});
					}
					if(find.length > 0 && find[0].image == null){
						var imgId = uuidv4();
						connection.query('INSERT INTO image (img_id,url) VALUES (?,?)',[imgId,imgId+ext],function (erro, findRe) {
							if(erro){
								logger.error('404 Not Found'); 
								res.status(404).json({message:"Not Found"});
							}
							if(findRe.affectedRows > 0){
								connection.query('UPDATE book SET image=? WHERE id =?',[imgId,req.params.id],function (erro, findR) {
									if(erro) {
										logger.error('404 Not Found'); 
										res.status(404).json({message:"Not Found"});
									}
									if(findR.affectedRows){
										cb(null, imgId+ext);										
									}else {
										cb(3);
									}
								});
							}else {
								cb(3);
							}
						});
						
					}else {
						cb(2);
					}
				});	
					
			}else{
				cb(1);		// 1 for not match 
			}				
		}
		}
	})

	var storageType = (process.env.NODE_ENV == "dev") ? storage : storages3;
	console.log("storage --------- ",storageType);
	var upload = multer({ storage: storageType }).single('image');

/*	app.post('/upload', upload(), function(req, res, next) {
		console.log("-----------",req);
	  res.send('Successfully uploaded ' + req.files.length + ' files!')
	})  
*/
	app.post('/book/:id/image', (req, res) => {
		sdc.increment('upload image');
		logger.info('inside upload image'); 
		//console.log("--------------",req.route);
		req.do = 'upload';
		upload(req, res, function (err) {
			console.log("req--------0",err);
			if (err){
				if(err == 1){
					logger.error('Image formats allowed png,jpg or jpeg'); 
					console.log(JSON.stringify(err));
					res.status(400).json({message:"Image formats allowed png,jpg or jpeg"});	
				}else if(err == 2){
					logger.error('book doesnot exists'); 
					res.status(404).json({message:"book doesnot exists"});
				}else{
					logger.error('403 error occured while image upload'); 
					res.status(403).json({message:"Error occured"});
				}
			} else {
				console.log("ascascascascac---------",req.file);
				var id = '';
				var filename = '';
				if(process.env.NODE_ENV == "dev") {
					id = req.file.filename.split('.').slice(0, -1).join('.');
					filename = imagePath+req.file.filename;
					res.json({id:id,url:filename});
				}else{
					filename = s3.getSignedUrl('getObject', {
						Bucket: conf.image.imageBucket,
						Key: req.file.key,
						Expires: signedUrlExpireSeconds }, (err, urlv) => {
						if (err){ 
							logger.error('s3 upload error occured while image upload'); 
							console.log("s3 upload err--------",err)
						}else{
							logger.info(urlv); 
							console.log("\n ------urlv-----------",urlv)
							id = req.file.key.split('.').slice(0, -1).join('.');
							res.json({id:id,url:urlv});
						}
					})	
					console.log(" \n s3 file name ------- ",filename,"-----",req.file.key,"-------",signedUrlExpireSeconds);
					//filename = '/'+req.file.key;
				}
			}
		});
	});

	app.put('/book/:id/image/:imgid', (req, res) => {
		sdc.increment('update image');
		logger.info('inside update image'); 
		req.do = 'update';
		console.log("--------req----------",req);
		upload(req, res, function (err) {
			console.log("req--------0",err);
			if (err){
				if(err == 1){
					logger.error("Image formats allowed png,jpg or jpeg"); 
					console.log(JSON.stringify(err));
					res.status(400).json({message:"Image formats allowed png,jpg or jpeg"});	
				}else if(err == 2){
					logger.error("Image does not Exists"); 
					res.status(404).json({message:"Image does not Exists"});
				}else if(err == 3){
					logger.error("Book does not exists"); 
					res.status(404).json({message:"Book does not exists"});
				}else{
					logger.error("403 Error occured"); 
					res.status(403).json({message:"Error occured"});
				}
			} else {
				var id = '';
				var filename = '';
				if(process.env.NODE_ENV == "dev") {
					id = req.file.filename.split('.').slice(0, -1).join('.');
					filename = imagePath+req.file.filename;
				}else{
					filename = s3.getSignedUrl('getObject', {
						Bucket: conf.image.imageBucket,
						Key: req.file.key,
						Expires: signedUrlExpireSeconds
					})	
					id = req.file.key.split('.').slice(0, -1).join('.');
					//filename = '/'+req.file.key;
				}
				logger.info(filename); 
				res.json({id:id,url:filename});
			}
		});		
	});	

	app.delete('/book/:id/image/:imgid', (req, res) => {
		sdc.increment('delete image');
		logger.info('inside delete image'); 
		connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
			if(erro) res.status(403).json({message:"Error occurred"});
			if(find.length == 0){ res.status(204).json({message:"book does not exists"}); }else{
				if(find[0].image != null){
					connection.query('SELECT * FROM image WHERE img_id = ?',[req.params.imgid],function (error,resultSelect, field) {
						if(error) res.status(204).json({message:"No image Content to delete"}); 
						if(resultSelect.length > 0){
							if(resultSelect[0].img_id == find[0].image){
							connection.query('DELETE FROM image WHERE img_id = ?',[find[0].image],function (error,resulti, field) {
								if(error) res.status(204).json({message:"No image Content to delete"}); 
								if(resulti.affectedRows){
									if(process.env.NODE_ENV == "dev"){
										fs.unlink(imageDir+resultSelect[0].url);
									}else{
										deletefile(resultSelect[0].url);
									}
									connection.query('UPDATE book SET image=? WHERE id =?',[null,req.params.id],function (erro, findR) {
										if(erro) res.status(404).json({message:"Not Found"});
										if(findR.affectedRows){
											logger.info("deleted successfully"); 
											res.json({message:"deleted successfully"});
										}	
									});
								}else{
									logger.info("No image Content to delete"); 
									res.status(204).json({message:"No image Content to delete"});
								}
							});
							}else{
								logger.info("Image doesnot belong to this book"); 
								res.status(204).json({message:"Image doesnot belong to this book"});	
							}
						}else{
							logger.info("image does not exists in table"); 
							res.status(204).json({message:"image does not exists in table"});
						}	
					});		
				}else {
					logger.error("image does not exists in table"); 
					res.status(204).json({message:"image does not exists in table"});
				}
			}
		});	
	});	

	app.get('/book/:id/image/:imgid', (req, res) => {
		sdc.increment('get image');
		connection.query('SELECT * FROM book WHERE id =?',[req.params.id],function (erro, find) {
			if(erro) res.status(403).json({message:"Error occurred"});
			if(find.length == 0){ res.status(403).json({message:"book does not exists"}); }else{
				if(find[0].image != null){
					connection.query('SELECT * FROM image WHERE img_id = ?',[req.params.imgid],function (error,resultSelect, field) {
						if(error) {
							logger.error("No image Content to delete"); 
							res.status(204).json({message:"No image Content to delete"}); 
						}if(resultSelect.length > 0){
							if(resultSelect[0].img_id == find[0].image){
								res.json({id:resultSelect[0].img_id,url:imagePath+resultSelect[0].url});
							}else{
								logger.error("Image doesnot belong to this book"); 
								res.status(404).json({message:"Image doesnot belong to this book"});	
							}
						}else{
							logger.error("image does not exists in table"); 
							res.status(404).json({message:"image does not exists in table"});
						}	
					});		
				}else {
					logger.error("Book does not Exists"); 
					res.status(404).json({message:"Book does not Exists"});
				}
			}
		});	
	});	

module.exports = app;