package orders

// ValidNIP reports whether s is a syntactically valid Polish NIP: 10 digits
// satisfying the weighted mod-11 checksum. Registry validity (GUS) is the
// invoicing provider's job (plan 18).
func ValidNIP(s string) bool {
	if len(s) != 10 {
		return false
	}
	weights := [...]int{6, 5, 7, 2, 3, 4, 5, 6, 7}
	sum := 0
	for i := 0; i < 9; i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
		sum += int(s[i]-'0') * weights[i]
	}
	if s[9] < '0' || s[9] > '9' {
		return false
	}
	check := sum % 11
	return check != 10 && check == int(s[9]-'0')
}
