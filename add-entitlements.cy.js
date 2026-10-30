
describe('Leave Entitlements - 10 Test Cases', () => {

  beforeEach(() => {
    cy.visit('https://opensource-demo.orangehrmlive.com/web/index.php/auth/login')

    cy.get('input[name="username"]').type('Admin')
    cy.get('input[name="password"]').type('admin123')
    cy.get('button[type="submit"]').click()

    cy.url().should('include', '/dashboard')

    cy.visit(
      'https://opensource-demo.orangehrmlive.com/web/index.php/leave/addLeaveEntitlement'
    )
  })

  // TC01: Kiểm tra mở trang add Entitlements
  it('TC01 - Open add Entitlements page', () => {
    cy.get('body').should('be.visible')
  })

  // TC02: Kiểm tra URL trang add Entitlements
  it('TC02 - Verify add Entitlements URL', () => {
    cy.url().should('include', '/leave/addLeaveEntitlement')
  })

  // TC03: Tìm kiếm nhân viên ailaai talata
  it('TC03 - Search employee Ranga  Akunuri', () => {
   cy.get('#app input[placeholder="Type for hints..."]').click();
cy.get('#app input[placeholder="Type for hints..."]').type('Ranga  Akunur');
cy.get('#app div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
cy.get('#app div:nth-child(2) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
cy.get('#app div:nth-child(2) > input.oxd-input').click();
cy.get('#app input.oxd-input--focus').type('6');
cy.get('#app button.orangehrm-left-space').click();
cy.get('#app button.orangehrm-button-margin.oxd-button--secondary').click();
  })

  // TC04: Kiểm tra bộ lọc Employee Name
  it('TC04 - test mutip employee', () => {
    cy.url().should('include', '/leave/addLeaveEntitlement')
    cy.get('#app div:nth-child(2) > div:nth-child(2) > div.oxd-radio-wrapper > label').click();
    cy.get('#app input[value="1"]').check();
    cy.get('#app i.bi-caret-up-fill').click();
    cy.get('#app div:nth-child(2) > div.orangehrm-full-width-grid > div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
    cy.get('#app div:nth-child(2) > input.oxd-input').click();
    cy.get('#app input.oxd-input--focus').type('8');
    cy.get('#app i.bi-caret-up-fill').click();
    cy.get('#app div:nth-child(3) > div.orangehrm-full-width-grid > div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
    cy.get('#app button.orangehrm-left-space').click();
    cy.get('#app div:nth-child(6) div.oxd-form-actions button.orangehrm-left-space').click();
  })

  
  it('TC05 ', () => {
       cy.get('#app input[placeholder="Type for hints..."]').click();
cy.get('#app input[placeholder="Type for hints..."]').type('Ranga  Akunur');
cy.get('#app div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
cy.get('#app div:nth-child(2) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
cy.get('#app div:nth-child(2) > input.oxd-input').click();
cy.get('#app input.oxd-input--focus').type('fskjhfkjshfk');
cy.get('#app button.orangehrm-left-space').click();
cy.get('#app button.orangehrm-button-margin.oxd-button--secondary').click();
  })

  // TC06: 
    it('TC06 - Display Leave Period filter', () => {
    cy.url().should('include', '/leave/addLeaveEntitlement')
    cy.get('#app div:nth-child(2) > div:nth-child(2) > div.oxd-radio-wrapper > label').click();
    cy.get('#app input[value="1"]').check();
    cy.get('#app i.bi-caret-up-fill').click();
    cy.get('#app div:nth-child(2) > div.orangehrm-full-width-grid > div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
    cy.get('#app div:nth-child(2) > input.oxd-input').click();
    cy.get('#app input.oxd-input--focus').type('kjhfkajhskfj');
    cy.get('#app i.bi-caret-up-fill').click();
    cy.get('#app div:nth-child(3) > div.orangehrm-full-width-grid > div:nth-child(1) > div.oxd-input-group > div:nth-child(2) > div.oxd-select-wrapper > div.oxd-select-text > div.oxd-select-text--after > i.oxd-icon').click();
    cy.get('#app button.orangehrm-left-space').click();
    cy.get('#app div:nth-child(6) div.oxd-form-actions button.orangehrm-left-space').click();
  })

   //TC07: Kiểm tra bộ lọc Include
  it('TC07 - Display Include filter', () => {
    cy.url().should('include', '/leave/addLeaveEntitlement')
    cy.get('#app button.oxd-button--ghost').click();

  })

  // TC08: Kiểm tra bộ lọc Sub Unit
  it('TC08 - Display Sub Unit filter', () => {
    
  })
/*
  // TC09: Kiểm tra nút Search
  it('TC09 - Search button is available', () => {
    cy.get('button[type="submit"]')
      .should('be.visible')
      .and('be.enabled')
  })

  // TC10: Kiểm tra nút Reset xóa nội dung Employee Name
  it('TC10 - Reset Employee Name filter', () => {
    const employeeName = cy.get('input[placeholder="Type for hints..."]').first()

    employeeName.type('ailaai')
    cy.contains('button', 'Reset').click()
    employeeName.should('have.value', '')
  })*/
})
