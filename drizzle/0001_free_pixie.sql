CREATE TABLE `cnabFiles` (
	`id` varchar(64) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileSize` varchar(64),
	`status` enum('pending','processing','completed','error') NOT NULL DEFAULT 'pending',
	`qprofNumber` varchar(64),
	`uploadedAt` timestamp DEFAULT (now()),
	`processedAt` timestamp,
	`userId` varchar(64) NOT NULL,
	CONSTRAINT `cnabFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cnabLogs` (
	`id` varchar(64) NOT NULL,
	`fileId` varchar(64) NOT NULL,
	`timestamp` timestamp DEFAULT (now()),
	`level` enum('info','warning','error','success') NOT NULL,
	`message` text NOT NULL,
	`details` text,
	CONSTRAINT `cnabLogs_id` PRIMARY KEY(`id`)
);
