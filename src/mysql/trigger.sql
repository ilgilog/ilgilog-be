DELIMITER $$
CREATE TRIGGER update_point BEFORE UPDATE ON stat
FOR EACH ROW
BEGIN
    IF NEW.earned <> OLD.earned OR NEW.used <> OLD.used THEN
        SET NEW.point = NEW.earned - NEW.used;
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER insert_point BEFORE INSERT ON stat
FOR EACH ROW
BEGIN
    SET NEW.point = NEW.earned - NEW.used;
END$$
DELIMITER ;


DELIMITER $$
CREATE TRIGGER auto_insert_store
AFTER INSERT ON user
FOR EACH ROW
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE obj_id INT;
    DECLARE cur_objet CURSOR FOR SELECT id FROM objet;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN cur_objet;

    read_loop: LOOP
        FETCH cur_objet INTO obj_id;
        IF done THEN
            LEAVE read_loop;
        END IF;

        INSERT INTO store (uid, oid) VALUES (NEW.id, obj_id);
    END LOOP;
    
    CLOSE cur_objet;
END$$
DELIMITER ;

<<<<<<< HEAD

DELIMITER //
CREATE TRIGGER minime_evolution AFTER UPDATE ON ilgilog.stat
FOR EACH ROW
BEGIN
    IF NEW.xp IN (7, 40, 100) THEN
        UPDATE ilgilog.user SET mid = mid + 1 WHERE id = NEW.uid;
    END IF;
END;
//
DELIMITER ;

SHOW TRIGGERS;

=======
SHOW TRIGGERS;
>>>>>>> 5564b834f2b6a3173e44e462688b2186c4aad8c3
