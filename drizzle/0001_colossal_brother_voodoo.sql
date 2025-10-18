ALTER TABLE `users` ADD `password` varchar(255);

--> statement-breakpoint
INSERT INTO `users` (`id`, `name`, `email`, `loginMethod`, `password`, `role`, `createdAt`, `lastSignedIn`) VALUES
(UUID(), 'Rafael UDS', 'rafael@uds.com.br', 'email', 'f5ef17e3bfb5f4d06489236ec6aed7d6660ad10d22e6ef2c43677de5b4b83c4c', 'admin', NOW(), NOW());
