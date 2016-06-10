var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, 200/200, 0.1, 1000 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( 200, 200 );
$('#maze-3D').append( renderer.domElement );

var geometry = new THREE.BoxGeometry( 1, 1, 1 );
var materialCube = new THREE.MeshBasicMaterial( { color: 0x00ffff } );
var materialCubeVisited = new THREE.MeshBasicMaterial( { color: 0x0000ff } );
var materialCubeStart = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
var materialCubeEnd = new THREE.MeshBasicMaterial( { color: 0xff0000 } );
var materialWall = new THREE.MeshBasicMaterial( { color: 0xffff00 } );

camera.position.z = 10;

var render = function () {
    requestAnimationFrame( render );

    scene.rotation.y += 0.5 * Math.PI / 180;
    scene.rotation.x += 0.5 * Math.PI / 180;
    scene.rotation.Z += 0.5 * Math.PI / 180;

    renderer.render(scene, camera);
};

render();



var mazeGenerator = {
    map    : [],

    DIRECTIONS : {
        'N' : { dy: -1, opposite: 'S' },
        'S' : { dy:  1, opposite: 'N' },
        'E' : { dx:  1, opposite: 'W' },
        'W' : { dx: -1, opposite: 'E' }
    },

    prefill : function () {
        for (var x = 0; x < this.WIDTH; x++) {
            this.map[x] = [];
            for (var y = 0; y < this.HEIGHT; y++) {
                this.map[x][y] = {};
            }
        }
    },

    shuffle : function (o) {
        for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    },

    carve : function (x0, y0, direction) {

        var x1 = x0 + (this.DIRECTIONS[direction].dx || 0),
            y1 = y0 + (this.DIRECTIONS[direction].dy || 0);

        if (x1 == this.WIDTH || y1 == this.HEIGHT) {
            return;
        }


        if ( this.map[x1][y1].seen ) {
            return;
        }

        this.map[x0][y0][ direction ] = true;
        this.map[x1][y1][ this.DIRECTIONS[direction].opposite ] = true;
        this.map[x1][y1].seen = true;

        var directions;

        if(x1 == 0 && (y1 != 0 && y1 != this.HEIGHT))
        {
            directions = this.shuffle([ 'N', 'S', 'E' ]);
        } else if(x1 == 0 && y1 == 0)
        {
            directions = this.shuffle([ 'S', 'E' ]);
        } else if(x1 == 0 && y1 == this.HEIGHT)
        {
            directions = this.shuffle([ 'N', 'E' ]);
        } else if(y1 == 0 && (x1 != 0 && x1 != this.WIDTH))
        {
            directions = this.shuffle([ 'S', 'E', 'W' ]);
        } else if(y1 == 0 && x1 == 0)
        {
            directions = this.shuffle([ 'S', 'E' ]);
        } else if(y1 == 0 && x1 == this.WIDTH)
        {
            directions = this.shuffle([ 'S', 'W' ]);
        } else {
            directions = this.shuffle([ 'N', 'S', 'E', 'W' ]);
        }

        for (var i = 0; i < directions.length; i++) {
            this.carve(x1, y1, directions[i]);
        }
    },

    output : function () {

        var output="";
        for (var y = 0; y < this.HEIGHT; y++) {
            output += "<div class='row'> ";
            for (var x = 0; x < this.WIDTH; x++) {
                output += "<span class='cell ";
                output += x ? "" : " left";
                output += y ? "" : " top";
                output += this.map[x][y].S ? "" : " bottom";
                output += this.map[x][y].E ? "" : " right";
                output += "'></span> ";
            }

            output += "</div>";
        }


        return output;
    },

    /**
     * @return {{}}
     */
    JSONoutput : function () {

        var json = {};

        json.height = this.HEIGHT;
        json.width = this.WIDTH;
        json.cells = [];

        for (var y = 0; y < this.HEIGHT; y++) {
            for (var x = 0; x < this.WIDTH; x++) {
                var  cell = {};
                this.map[x][y].S ? cell.down=true : cell.down=false;
                this.map[x][y].E ? cell.right=true : cell.right=false;

                json.cells.push(cell);

            }
        }

        return json;
    }
};

var generateMaze = function() {
    mazeGenerator.HEIGHT = $("#maze-height").val();
    mazeGenerator.WIDTH = $("#maze-width").val();

    mazeGenerator.prefill();
    mazeGenerator.carve(Math.floor(mazeGenerator.WIDTH/2), Math.floor(mazeGenerator.HEIGHT/2), 'N');

    var outputJSON = mazeGenerator.JSONoutput();

    displayMaze(outputJSON);

    var data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(outputJSON));

    var a = document.createElement('a');
    a.href = 'data:' + data;
    a.download = 'data.json';
    a.innerHTML = 'download JSON';

    var container = document.getElementById('maze-json');
    container.innerHTML = '';
    container.appendChild(a);


};

var importMaze = function() {
    $('#maze-json').html('');
    var fileObj = $('#maze-import').get(0).files[0];
    var objectURL = window.URL.createObjectURL(fileObj);
    $.get(objectURL, function(data)
        {
            displayMaze(data);
        }
    );
};

var matrix = [];
var stepSolveMaze = 0;
var nodeList = [];
var maze;

var displayMaze = function(mazeJSON) {
    maze = mazeJSON;
    maze.solved = false;
    $('.resolution').children('button').attr('disabled',false);

    var height = maze.height;
    var width = maze.width;

    //3D remove all objects
    for( var i = scene.children.length - 1; i >= 0; i--) { }

    scene = new THREE.Scene();

    stepSolveMaze = 0;

    matrix=[];
    $('#maze').html('');
    $('#maze-grid').html('');


    var currentRow = [];
    var currentRowHTML = $("<div class='row'></div>");
    var lowerRow = [];
    var lowerRowHTML = $("<div class='row obstacles'></div>");

    var y=0;
    $.each(maze.cells, function(index, cell) {
        var mod = index%width;
        var cellHTML = $("<span class='cell'></span>");

        currentRow.push(0);
        currentRow.push(cell.right? 0:1);
        lowerRow.push(cell.down? 0:1);
        lowerRow.push(1);

        if(index == 0)
        {
            addTo3DMaze("wall", -1, -1);
        }

        if(index < width)
        {
            addTo3DMaze("wall",-1,mod*2);
            addTo3DMaze("wall",-1,mod*2+1);
        }

        if(mod == 0)
        {
            addTo3DMaze("wall",y*2,-1);
            addTo3DMaze("wall",y*2+1,-1);
        }


        currentRowHTML.append($("<span class='cell'></span>"));
        addTo3DMaze("cell", y*2, mod*2);

        currentRowHTML.append(cell.right? $("<span class='cell'></span>"):$("<span class='obstacle'></span>"));
        addTo3DMaze(cell.right?"cell":"wall", y*2, mod*2+1);

        lowerRowHTML.append(cell.down? $("<span class='cell'></span>"):$("<span class='obstacle'></span>"));
        addTo3DMaze(cell.down?"cell":"wall", y*2+1, mod*2);

        lowerRowHTML.append($("<span class='obstacle'></span>"));
        addTo3DMaze("wall", y*2+1, mod*2+1);



        if(mod == width-1)
        {
            y++;

            matrix.push(currentRow);
            matrix.push(lowerRow);

            $('#maze-grid').append(currentRowHTML);
            $('#maze-grid').append(lowerRowHTML);

            currentRow=[];
            lowerRow=[];
            currentRowHTML = $("<div class='row'></div>");
            lowerRowHTML = $("<div class='row obstacles'></div>");
        }



        cellHTML.addClass(index < width ? 'up':'');
        cellHTML.addClass(mod == 0 ? 'left':'');
        cellHTML.addClass(cell.down? '':'down');
        cellHTML.addClass(cell.right? '':'right');

        cellHTML.data('visited', false);
        cellHTML.data('index', index);

        cellHTML.data('directions', []);

        cell.down?cellHTML.data('directions').push('S'):'';
        cell.right?cellHTML.data('directions').push('E'):'';

        if(index >= width)
        {
            var cellUp = $('#cell-'+(index-width));

            $.inArray('S', cellUp.data('directions'))!==0?cellHTML.data('directions').push('N'):'';

            if(mod!=0)
            {
                var cellLeft = $('#cell-'+(index-1));
                $.inArray('E', cellLeft.data('directions'))!==0?cellHTML.data('directions').push('W'):'';
            }

        }

        $('#maze').append(cellHTML);


        if(mod == width-1)
        {
            $('#maze').append('<br/>');
        }
    });
    camera.lookAt( scene.position );
    camera.position.z = (width>height? width:height)*4;
    renderer.setSize( (width>height? width:height)*30, (width>height? width:height)*30 );

    scene.getObjectByName( "cube[0][0]" ).material = materialCubeStart;

    scene.getObjectByName( "cube["+((height-1)*2)+"]["+((width-1)*2)+"]" ).material = materialCubeEnd;

    $("#maze-grid").data({"startX":0,"startY":0,"endX":width*2,"endY":height*2});
    $("#maze-grid").children(".row:nth-child(1)").children("span:nth-child(1)").addClass('start');
    $("#maze-grid").children(".row:nth-child("+(height*2-1)+")").children("span:nth-child("+(width*2-1)+")").addClass('end');



};



var addTo3DMaze = function(type,Y,X)
{

    var object = new THREE.Mesh( geometry, type=="wall"? materialWall : materialCube);

    object.name = "cube["+Y+"]["+X+"]";
    object.translateX(X);
    object.translateY(-Y);
    scene.add( object );

};

var solveMaze = function()
{
    if(!maze.solved)
    {
        var startX = $("#maze-grid").data('startX');
        var startY = $("#maze-grid").data('startY');
        //var endX = 18;
        //var endY = 18;
        var endX = $("#maze-grid").data('endX')-2;
        var endY = $("#maze-grid").data('endY')-2;
        var grid = new PF.Grid(matrix);
        var gridBackup = grid.clone();
        var finder = new PF.BestFirstFinder();
        var path = finder.findPath(startX, startY, endX, endY, gridBackup);
        nodeList = finder.getNodeList();

        for (var i = 0; i <path.length; i++)
        {
            $("#maze-grid").children(".row:nth-child("+(path[i][1]+1)+")").children("span:nth-child("+(path[i][0]+1)+")").addClass('visited');

            var cube = scene.getObjectByName( "cube["+(path[i][1])+"]["+(path[i][0])+"]" );

            cube.material= materialCubeVisited;
        }

        maze.solved = true;
        $('.resolution').children('button').attr('disabled', true);

    }
};

var nextStepSolveMaze = function(){

    var startX = $("#maze-grid").data('startX');
    var startY = $("#maze-grid").data('startY');
    var endX = $("#maze-grid").data('endX')-2;
    var endY = $("#maze-grid").data('endY')-2;

    var grid = new PF.Grid(matrix);
    var gridBackup = grid.clone();
    var finder = new PF.BestFirstFinder();
    var path = finder.findPath(startX, startY, endX, endY, gridBackup);
    nodeList = finder.getNodeList();

    if(stepSolveMaze < nodeList.length)
    {
        $("#maze-grid").children(".row:nth-child("+(nodeList[stepSolveMaze]['y']+1)+")").children("span:nth-child("+(nodeList[stepSolveMaze]['x']+1)+")").addClass('visited');

        var cube = scene.getObjectByName( "cube["+nodeList[stepSolveMaze]['y']+"]["+nodeList[stepSolveMaze]['x']+"]" );

        cube.material= materialCubeVisited;


        stepSolveMaze++;

    }

    if(stepSolveMaze == nodeList.length)
    {
        maze.solved = true;
        $('.resolution').children('button').attr('disabled', true);
    }
};

