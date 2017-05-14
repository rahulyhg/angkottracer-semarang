<?php
// DIC configuration

$container = $app->getContainer();

// view renderer
$container['renderer'] = function ($c) {
    $settings = $c->get('settings')['renderer'];
    return new Slim\Views\PhpRenderer($settings['template_path'], [
        'baseUrl' => '/angkottracer/rest/public'
    ]);
};

// monolog
$container['logger'] = function ($c) {
    $settings = $c->get('settings')['logger'];
    $logger = new Monolog\Logger($settings['name']);
    $logger->pushProcessor(new Monolog\Processor\UidProcessor());
    $logger->pushHandler(new Monolog\Handler\StreamHandler($settings['path'], $settings['level']));
    return $logger;
};

// database
$container['db'] = function ($c) {
	$db = $c->get('settings')['db'];
	/*$pdo = new PDO("mysql:host=" . $db['host'] . ";dbname=" . $db['dbname'],
			$db['user'], $db['pass']);
	
	$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
	$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);*/
	
	$mysqli = new mysqli($db['host'], $db['user'], $db['pass'], $db['dbname']);
	return $mysqli;
};

//-- Autoload helpers
require_once __DIR__ . '/helpers/query_builder.php';