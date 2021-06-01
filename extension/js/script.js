var rootFolderId;
var fileId;
var authToken;
var fileExits;
$(document).ready(function(){
	updateAuthToken();

	//Authenticate the user
	$("#auth-button").click(function(){
		getAuthentication();
	});

	//Logout User
	$("#btn-logout").click(function(){
		chrome.storage.local.remove("authToken");
		var url = 'https://accounts.google.com/o/oauth2/revoke?token=' + authToken;
		window.fetch(url);

		chrome.identity.removeCachedAuthToken({token: authToken}, function (){
		});
		$("#file-area").slideUp();
		$(".auth-area").slideDown();
	});	

	$("#btn-restore").click(function(){
		getContentOfFile(fileId);
	});

	$("#btn-backup").click(function(){
		var content=$("#file-edit").val();
		console.log(content);
		saveFile(fileId,content);
	});
});

function loadClientLib()
{
	$("#file-area").slideDown();
	setMsg("User Authenticated");
	gapi.load('client',loadClientCallBack);
}

function updateAuthToken()
{
	chrome.storage.local.get("authToken",function(obj){
		if(obj.authToken!=null){
			chrome.identity.getAuthToken({"interactive":true},function(token){
				console.log("token: "+token);
				chrome.storage.local.set({authToken:token},function(){
					authToken=token;
					setMsg("User Authenticated");
					loadClientLib();
					$("#file-area").slideDown();
				})
			});
		}
		else
		{
			$(".auth-area").slideDown();
		}
	});
	
}

function getAuthentication()
{
	chrome.identity.getAuthToken({"interactive":true},function(token){
		console.log("token: "+token);
		if(token!=null){
			chrome.storage.local.set({authToken:token},function(){
				authToken=token;
				setMsg("User Authenticated");
				loadClientLib();
				$("#file-area").slideDown();
			})
		}
	});
}

function loadClientCallBack()
{
	gapi.client.setToken({'access_token':authToken});
	gapi.client.load("drive","v2",function(){
		var request = gapi.client.drive.about.get();
		request.execute(loadDriveCallBack);
	});
}



//Loads driver
function loadDriveCallBack(resp)
{
	rootFolderId=resp.rootFolderId;
	try{
			//Find File Query
			var request=gapi.client.drive.files.list({
				q:"title contains 'fl_17602241'"
			});
			request.execute(function(response){
				console.log("res",response);
				console.log("items",response.items);
				if(response.items.length>0)
				{
					fileId=response.items[0].id;
					getContentOfFile(fileId);
				}
				else{
					insertNewFile(rootFolderId);
					console.log("File added");
				}
			});
		}
		catch(e){
			console.log("Error:",e);
		}
}



	


	

//Create Data Which is empty and pass it to insertFile to save it
function insertNewFile(folderId) {
	var content = " ";
	var FolderId = "";
	var contentArray = new Array(content.length);
        for (var i = 0; i < contentArray.length; i++) {
            contentArray[i] = content.charCodeAt(i);
        }
        var byteArray = new Uint8Array(contentArray);
        var blob = new Blob([byteArray], {type: 'text/plain'}); 
	insertFile(blob, null, folderId);
}

//Make a new file and save it to drive
function insertFile(fileData, callback, folderId) {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  var reader = new FileReader();
  reader.readAsBinaryString(fileData);
  reader.onload = function(e) {
    var contentType = fileData.type || 'application/octet-stream';
    var metadata = {
      'title': "fl_17602241.txt",
      'mimeType': contentType
    };

    var base64Data = btoa(reader.result);
    var multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;

    var request = gapi.client.request({
        'path': '/upload/drive/v2/files',
        'method': 'POST',
        'params': {'uploadType': 'multipart'},
        'headers': {
          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody});

    request.execute(function(){
    	setMsg("New file has been created");
    });
  }
}


function getContentOfFile(theID){ //gets the content of the file
	console.log(theID);
    current = theID;
    gapi.client.request({'path': '/drive/v2/files/'+theID,'method': 'GET',callback: function ( theResponseJS, theResponseTXT ) {
		var myXHR   = new XMLHttpRequest();
        myXHR.open('GET', theResponseJS.downloadUrl, true );
        myXHR.setRequestHeader('Authorization', 'Bearer ' + authToken );
        myXHR.onreadystatechange = function( theProgressEvent ) {
            if (myXHR.readyState == 4) {
                if ( myXHR.status == 200 ) {
                	$("#file-edit").val(myXHR.response);
                	console.log("Centent: ",myXHR.response);
                	setMsg("File Restored");
				}
            }
        }
        myXHR.send();
        }
    });
}

function getFileId()
{
	var request=gapi.client.drive.files.list({
		q:"title contains 'fl_17602241'"
	});
	request.execute(function(response){
		if(response.items.length<=0)
			insertNewFile(rootFolderId);
		return response.items[0].id;
	});
}


function saveFile(fileId, content){
	console.log(fileId);
    if(typeof content !== "undefined"){ 
        var contentArray = new Array(content.length);
        for (var i = 0; i < contentArray.length; i++) {
            contentArray[i] = content.charCodeAt(i);
        }
        var byteArray = new Uint8Array(contentArray);
        var blob = new Blob([byteArray], {type: 'text/plain'});
        var request = gapi.client.drive.files.get({'fileId': fileId});
        request.execute(function(resp) {
            updateFile(fileId,resp,blob,null);
        });
    }
}
function updateFile(fileId, fileMetadata, fileData, callback) { 
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  var reader = new FileReader();
  reader.readAsBinaryString(fileData);
  reader.onload = function(e) {
    var contentType = fileData.type || 'application/octet-stream';
    var base64Data = btoa(reader.result);
    var multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;

    var request = gapi.client.request({
        'path': '/upload/drive/v2/files/' + fileId,
        'method': 'PUT',
        'params': {'uploadType': 'multipart', 'alt': 'json'},
        'headers': {
          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
        },
        'body': multipartRequestBody});
    if (!callback) {
      callback = function(file) {
      	setMsg("File Saved");
      };
    }
    request.execute(callback);
  }

}

function setMsg(msg)
{
	$("#msg").text(msg);
	setTimeout(function(){
		$("#msg").text("");
	},3000);
}