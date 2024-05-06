
-- 만료된 토큰 데이터 삭제 이벤트
CREATE EVENT delete_expired_tokens
ON SCHEDULE
    EVERY 1 DAY
    STARTS TIMESTAMP(CONCAT(CURRENT_DATE, ' 00:00:00'))
DO
    DELETE FROM ilgilog.verification WHERE exp_date < NOW();

-- 좋아요 누르지 않은 데이터 삭제 이벤트
CREATE EVENT delete_thumbs_off
ON SCHEDULE
    EVERY 1 DAY
    STARTS TIMESTAMP(CONCAT(CURRENT_DATE, ' 01:00:00'))
DO
    DELETE FROM ilgilog.thumbs WHERE status = 1;

-- 공지사항의 new flag 변환 이벤트
CREATE EVENT notice_check
ON SCHEDULE
    EVERY 1 DAY
    STARTS TIMESTAMP(CONCAT(CURRENT_DATE, ' 02:00:00'))
DO
    UPDATE ilgilog.notice
	SET new = 0
	WHERE reg_date < DATE_SUB(CURDATE(), INTERVAL 1 WEEK);