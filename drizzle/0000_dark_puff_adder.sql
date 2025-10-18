CREATE TABLE `automationRoutines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`company` varchar(255) NOT NULL,
	`folderPath` varchar(500) NOT NULL,
	`frequency` enum('hourly','daily','weekly') NOT NULL,
	`status` enum('active','paused','error') NOT NULL DEFAULT 'active',
	`lastRun` timestamp,
	`nextRun` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `automationRoutines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cnabFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`filePath` varchar(500) NOT NULL,
	`company` varchar(255),
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`qprofNumber` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `cnabFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cnabLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` varchar(64) NOT NULL,
	`timestamp` timestamp DEFAULT (now()),
	`message` text NOT NULL,
	CONSTRAINT `cnabLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cnabScreenshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` int NOT NULL,
	`step` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`path` varchar(500) NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `cnabScreenshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoredFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routineId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`filepath` varchar(500) NOT NULL,
	`fileHash` varchar(64) NOT NULL,
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`qprofNumber` varchar(64),
	`importedAt` timestamp,
	`error` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `monitoredFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp DEFAULT (now()),
	`lastSignedIn` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);


--> statement-breakpoint
INSERT INTO `users` (`id`, `name`, `email`, `loginMethod`, `role`, `createdAt`, `lastSignedIn`) VALUES
('user_seed_uuid', 'Rafael UDS', 'rafael@uds.com.br', 'email', 'admin', NOW(), NOW());
