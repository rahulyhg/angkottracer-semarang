/**
 * Edge management subroutine
 */

function new_edge() {
	if (focusedMarker == null) return;
	
	currentState = STATE_SELECTNODE;
	node_selected_callback = function (selectedMarker) {
		show_modal(URL_MODAL, {
			'name': 'edge.add',
			'data': {'id_node_1': focusedMarker.id_node, 'id_node_2': selectedMarker.id_node}
		}, function(response){
			//-- Insert and render the new edge
			activeLines.push(new google.maps.Polyline({
				path: [focusedMarker.position, selectedMarker.position],
				geodesic: false,
				strokeColor: '#FF0000',
				strokeOpacity: 1.0,
				strokeWeight: 1,
				clickable: false,
				map: map
			}));
			
			reversibleLabel = (response.data.reversible?"Yes":"No");
			$("#table_edge tbody").append(
					'<tr><td>'+response.data.id+
					'</td><td>'+response.data.distance+
					'</td><td>'+reversibleLabel+'</td><td>edit | <a href="#">hapus</a></td></tr>');
			
			//-- Saved and add into edge network
			_gui_push_edge(response.data.id, [focusedMarker.position, selectedMarker.position], response.data.reversible);
			hide_modal();
			reset_gui();
		}, function(){
			
		});
	};
	update_gui();
}

function edit_edge_setat_(i) {
	var newLength = google.maps.geometry.spherical.computeLength(activeEditingPolyLine.getPath());
	$("#edgeedit_distance").html((newLength/1000).toFixed(3));
	
	if (i == 0) {
		if (labelMarkers[0]) labelMarkers[0].setPosition(activeEditingPolyLine.getPath().getAt(i));
	} else if (i >= activeEditingPolyLine.getPath().getLength() -1) {
		if (labelMarkers[1]) labelMarkers[1].setPosition(activeEditingPolyLine.getPath().getAt(i));
	}
}
function edit_edge(idEdge) {
	//-- Fetch data
	_ajax_send({
		verb: 'edge.getbyid',
		id: idEdge
	}, function(jsonData){
		change_state(STATE_EDGESELECTED, edge_clear_workspace);
		clear_lines();
		
		var polyLineData = jsonData.edgedata.polyline_data;
		polyLineData.unshift(jsonData.edgedata.from.position);
		polyLineData.push(jsonData.edgedata.dest.position);
		
		//-- Draw polylines in the map
		if (activeEditingPolyLine) {
			activeEditingPolyLine.setMap(map);
			activeEditingPolyLine.setPath(polyLineData);
			activeEditingPolyLine.id_edge = idEdge;
			activeEditingPolyLine.reversible = jsonData.edgedata.reversible;
		} else {
			activeEditingPolyLine = new google.maps.Polyline({
				path: polyLineData,
				reversible: jsonData.edgedata.reversible,
				geodesic: false,
				strokeColor: '#162953',
				strokeOpacity: 1.0,
				strokeWeight: 2,
				clickable: false,
				editable: true,
				map: map,
				id_edge: idEdge
			});
			
			//-- Setup editing context menu
			ctxMenu = new VertexContextMenu();
			google.maps.event.addListener(activeEditingPolyLine.getPath(), 'set_at', edit_edge_setat_);
			google.maps.event.addListener(activeEditingPolyLine, 'rightclick', function(e) {
				// Check if click was on a vertex control point
				if (e.vertex == undefined) {
					return;
				}
				
				// Vertex pertama dan terakhir tidak bisa dihapus...
				if ((e.vertex == 0) || (e.vertex >= activeEditingPolyLine.getPath().getLength() -1)) {
					return;
				}
				
				ctxMenu.open(map, activeEditingPolyLine.getPath(), e.vertex);
			});
		}
		
		//-- Hide node markers
		activeMarkers.map(function(curMarker, i){
			curMarker.setVisible(false);
		});
		markerCluster.clearMarkers();
		
		//-- Start and end marker
		if (labelMarkers[0]) {
			labelMarkers[0].setPosition(jsonData.edgedata.from.position);
			labelMarkers[0].setMap(map);
			labelMarkers[0].setVisible(true);
		} else {
			labelMarkers[0] = new google.maps.Marker({
				position: jsonData.edgedata.from.position,
				map: map,
				label: 'A',
				title: 'Start',
				zIndex: -1,
				clickable: false
			});
		}
		
		if (labelMarkers[1]) {
			labelMarkers[1].setPosition(jsonData.edgedata.dest.position);
			labelMarkers[1].setMap(map);
			labelMarkers[1].setVisible(true);
		} else {
			labelMarkers[1] = new google.maps.Marker({
				position: jsonData.edgedata.dest.position,
				map: map,
				label: 'B',
				title: 'End',
				zIndex: -1,
				clickable: false
			});
		}
		
		edit_edge_setat_();
		
		update_gui(false);
	}, "Memuat...", URL_DATA_AJAX);
}

/*
 * Jika edit_edge akan menampilkan cursor editing, maka fungsi done_edit_edge akan
 * menyembunyikannya kembali...
 */
function edge_clear_workspace(oldState, newState) {
	if (labelMarkers[0]) labelMarkers[0].setVisible(false);
	if (labelMarkers[1]) labelMarkers[1].setVisible(false);
	
	//-- Reshow all markers
	activeMarkers.map(function(curMarker, i){
		curMarker.setVisible(true);
		markerCluster.addMarker(curMarker, false);
	});
}

function edge_do_delete_(idEdge, afterDeleteCallback) {
	_ajax_send({
		verb: 'edge.delete',
		id: idEdge
	}, function(jsonData){
		if (typeof(afterDeleteCallback) === 'function') {
			afterDeleteCallback(jsonData);
		}
	}, "Memproses...", URL_DATA_AJAX);
	
	return false;
}

function edge_rename() {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	alert("ID edge: "+activeEditingPolyLine.id_edge);
	return false;
}

function edge_save() {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	var edgePath = activeEditingPolyLine.getPath();
	var encStr = google.maps.geometry.encoding.encodePath(edgePath);
	
	_ajax_send({
		verb: 'edge.save',
		id: activeEditingPolyLine.id_edge,
		new_path: encStr
	}, function(jsonData){
		//-- Clone path
		var decPath = google.maps.geometry.encoding.decodePath(encStr);
		_gui_modify_edge(activeEditingPolyLine.id_edge, decPath, activeEditingPolyLine.reversible);
		toastr.success('Edge successfully saved.');
	}, "Menyimpan...", URL_DATA_AJAX);
	
	return false;
}

function edge_reset() {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	var uConf = confirm('Polyline akan hilang dan mungkin menghilangkan hasil pekerjaan Anda apabila edge direset. Reset edge? ');
	if (!uConf) return false;
	
	var activePolyLinePath = activeEditingPolyLine.getPath();
	var ctr; var upperBound = activePolyLinePath.getArray().length - 2;
	for (ctr = upperBound; ctr > 0; ctr--) {
		activePolyLinePath.removeAt(ctr);
	}
	return false;
}

function edge_getdir(opt_direction) {
	var direction_ = opt_direction || 1;
	
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	var uConf = confirm('Polyline akan hilang dan mungkin menghilangkan hasil pekerjaan Anda. Lanjutkan proses get direction? ');
	if (!uConf) return false;
	
	var activeEditingPolyLinePath = activeEditingPolyLine.getPath();
	
	var originPoint = activeEditingPolyLinePath.getAt(0).toJSON();
	var destPoint = activeEditingPolyLinePath.getAt(activeEditingPolyLinePath.getLength()-1).toJSON();
	
	_ajax_send({
		verb: 'edge.direction',
		origin: (direction_ > 0 ? originPoint : destPoint),
		dest: (direction_ > 0 ? destPoint : originPoint)
	}, function(jsonData){
		var coords = jsonData.path;
		
		var activePolyLinePath = activeEditingPolyLine.getPath();
		activePolyLinePath.clear();
		
		var ctr; var pointTotal = coords.length;
		
		if (direction_ > 0) {
			for (ctr = 0; ctr < pointTotal; ctr++) {
				activePolyLinePath.push(new google.maps.LatLng(coords[ctr].lat, coords[ctr].lng));
			}
		} else {
			for (ctr = pointTotal-1; ctr >= 0; ctr--) {
				activePolyLinePath.push(new google.maps.LatLng(coords[ctr].lat, coords[ctr].lng));
			}
		}
		
	}, "Memproses...", URL_DATA_AJAX);
	
	return false;
}
function edge_interpolate() {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	//-- Interpolasi dibatasi sampai 100 titik saja...
	var edgePath = activeEditingPolyLine.getPath();
	if (edgePath.getLength() > 100) {
		alert("Maksimum titik interpolasi adalah 100 titik. Silakan hapus beberapa dan coba lagi.");
		return false;
	}
	var uConf = confirm('Polyline akan hilang dan mungkin menghilangkan hasil pekerjaan Anda. Lanjutkan proses interpolasi? ');
	if (!uConf) return false;
	
	var encStr = google.maps.geometry.encoding.encodePath(edgePath);
	
	_ajax_send({
		verb: 'edge.interpolate',
		path: encStr
	}, function(jsonData){
		var coords = jsonData.snapdata;
		
		var activePolyLinePath = activeEditingPolyLine.getPath();
		activePolyLinePath.clear();
		
		var ctr; var pointTotal = jsonData.snapdata.length;
		for (ctr = 0; ctr < pointTotal; ctr++) {
			activePolyLinePath.push(new google.maps.LatLng(jsonData.snapdata[ctr].lat, jsonData.snapdata[ctr].lng));
		}
		
	}, "Memproses...", URL_DATA_AJAX);
	
	return false;
}

function edge_break(vertexIdx) {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	var uConf = confirm('Save selected edge and break?');
	if (!uConf) return false;
	
	var edgePath = activeEditingPolyLine.getPath();
	var encStr = google.maps.geometry.encoding.encodePath(edgePath);
	
	_ajax_send({
		verb: 'edge.saveandbreak',
		id: activeEditingPolyLine.id_edge,
		new_path: encStr,
		vertex_idx: vertexIdx
	}, function(jsonData){
		_gui_push_node(jsonData.new_node_id, jsonData.new_node_pos,
				'#'+jsonData.new_node_id+': '+jsonData.new_node_name);
		
		toastr.success('Edge successfully breaked.');
		focus_node(jsonData.new_node_id);
	}, "Menyimpan...", URL_DATA_AJAX);
	
	return false;
}
function edge_delete() {
	if (currentState != STATE_EDGESELECTED) return false;
	if (!activeEditingPolyLine) return false;
	
	var uConf = confirm('Hapus busur?');
	if (!uConf) return false;
	
	edge_do_delete_(activeEditingPolyLine.id_edge, function(){
		_gui_modify_edge(activeEditingPolyLine.id_edge, null);
		toastr.success('Edge successfully deleted.');
		reset_gui();
	});
	return false;
}